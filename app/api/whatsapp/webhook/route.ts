import { NextResponse, after } from "next/server";
import { safeEqual } from "@/lib/security/hash";
import { handleIncoming } from "@/lib/whatsapp/bot";
import { waConfig } from "@/lib/whatsapp/client";
import { parseWebhook, validSignature } from "@/lib/whatsapp/webhook";

export const runtime = "nodejs";

/**
 * GET /api/whatsapp/webhook. Meta's one-time check when the webhook is registered:
 * echo the challenge if the verify token matches WHATSAPP_VERIFY_TOKEN.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const { verifyToken } = waConfig();
  const ok =
    url.searchParams.get("hub.mode") === "subscribe" &&
    Boolean(verifyToken) &&
    safeEqual(url.searchParams.get("hub.verify_token") ?? "", verifyToken);
  if (!ok) return new NextResponse("forbidden", { status: 403 });
  return new NextResponse(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
}

/**
 * POST /api/whatsapp/webhook. Incoming messages. Answered straight away (Meta
 * retries slow webhooks); the conversation itself runs after the response.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const { appSecret } = waConfig();
  if (!appSecret) {
    console.error("[whatsapp] WHATSAPP_APP_SECRET is not set; refusing unsigned webhooks");
    return new NextResponse("not configured", { status: 503 });
  }
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }
  const messages = parseWebhook(body);
  if (messages.length) after(() => Promise.all(messages.map(handleIncoming)).then(() => undefined));
  return NextResponse.json({ ok: true });
}
