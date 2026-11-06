import { NextResponse } from "next/server";
import type { VerifyMethod } from "@/lib/store";
import { startVerification } from "@/lib/verify/phone";

export const runtime = "nodejs";

const METHODS: VerifyMethod[] = ["sms", "voice", "whatsapp", "missed_call"];

const STATUS = { invalid_phone: 400, unavailable: 503, rate_limited: 429, send_failed: 502 } as const;

/**
 * POST /api/verify/start
 * Body: { phone, method: "sms" | "voice" | "whatsapp" | "missed_call" }
 * Sends a code by SMS, voice call or WhatsApp, or returns the number to give a missed call to.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const method = METHODS.find((m) => m === body?.method);
  if (!method) return NextResponse.json({ error: `method must be one of ${METHODS.join(", ")}` }, { status: 400 });

  const r = await startVerification({ phone: String(body?.phone ?? ""), method });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: STATUS[r.error] });
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}
