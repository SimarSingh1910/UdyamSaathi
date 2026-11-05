import { NextResponse } from "next/server";
import { startVerification } from "@/lib/verify/phone";

export const runtime = "nodejs";

const STATUS = { invalid_phone: 400, unavailable: 503, rate_limited: 429, send_failed: 502 } as const;

/**
 * POST /api/verify/start
 * Body: { phone, method: "whatsapp" | "missed_call" }
 * Sends a WhatsApp code, or returns the number to give a missed call to.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const method = body?.method === "missed_call" ? "missed_call" : body?.method === "whatsapp" ? "whatsapp" : null;
  if (!method) return NextResponse.json({ error: "method must be whatsapp or missed_call" }, { status: 400 });

  const r = await startVerification({ phone: String(body?.phone ?? ""), method });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: STATUS[r.error] });
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}
