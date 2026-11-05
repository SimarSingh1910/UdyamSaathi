import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { demoAllowed } from "@/lib/verify/phone";
import { handleIncoming } from "@/lib/whatsapp/bot";
import { drainOutbox, putDemoMedia, whatsappLive } from "@/lib/whatsapp/client";

export const runtime = "nodejs";

/** Only while WhatsApp is not connected, and never in production unless demo mode is on. */
const enabled = () => demoAllowed() && !whatsappLive();
const off = () =>
  NextResponse.json({ error: "The simulator is off: WhatsApp is connected or demo mode is disabled." }, { status: 404 });
const validFrom = (from: unknown): from is string => typeof from === "string" && /^\d{10,15}$/.test(from);

/**
 * POST /api/whatsapp/simulate
 * Body: { from, name?, text?, replyId?, replyTitle?, image?: data URL }
 * Runs the message through the same bot as the real webhook and returns its replies.
 */
export async function POST(req: Request) {
  if (!enabled()) return off();
  const body = await req.json().catch(() => null);
  if (!validFrom(body?.from)) return NextResponse.json({ error: "from must be 10-15 digits" }, { status: 400 });

  let media: { id: string; mime: string } | undefined;
  if (typeof body.image === "string") {
    const m = body.image.match(/^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/);
    if (!m) return NextResponse.json({ error: "image must be a data URL" }, { status: 400 });
    const data = Buffer.from(m[2], "base64");
    if (data.length > 10 * 1024 * 1024) return NextResponse.json({ error: "file too large" }, { status: 413 });
    media = { id: putDemoMedia(data, m[1]), mime: m[1] };
  }

  await handleIncoming({
    id: `sim_${randomBytes(8).toString("hex")}`,
    from: body.from,
    profileName: typeof body.name === "string" ? body.name : undefined,
    text: typeof body.replyTitle === "string" ? body.replyTitle : typeof body.text === "string" ? body.text : undefined,
    replyId: typeof body.replyId === "string" ? body.replyId : undefined,
    media,
  });
  return NextResponse.json({ messages: drainOutbox(body.from) }, { headers: { "Cache-Control": "no-store" } });
}

/** GET /api/whatsapp/simulate?from=… Messages the bot sent on its own (e.g. after a missed call). */
export async function GET(req: Request) {
  if (!enabled()) return off();
  const from = new URL(req.url).searchParams.get("from");
  if (!validFrom(from)) return NextResponse.json({ error: "from must be 10-15 digits" }, { status: 400 });
  return NextResponse.json({ messages: drainOutbox(from) }, { headers: { "Cache-Control": "no-store" } });
}
