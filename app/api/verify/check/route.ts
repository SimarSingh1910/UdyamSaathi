import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/order-flow";
import { checkCode, issuePhoneToken, verificationIsFor } from "@/lib/verify/phone";

export const runtime = "nodejs";

/**
 * POST /api/verify/check
 * Body: { id, phone, code }
 * Returns a short-lived token to send with the order or help request.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const phone = normalizePhone(String(body?.phone ?? ""));
  if (!phone || typeof body?.id !== "string") return NextResponse.json({ error: "not_found" }, { status: 400 });

  const r = await checkCode(body.id, String(body.code ?? ""));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "wrong_code" ? 400 : 410 });
  if (!verificationIsFor(r.verification, phone)) return NextResponse.json({ error: "not_found" }, { status: 400 });
  return NextResponse.json({ token: issuePhoneToken(phone) }, { headers: { "Cache-Control": "no-store" } });
}
