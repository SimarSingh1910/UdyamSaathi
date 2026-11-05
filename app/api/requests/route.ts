import { NextResponse } from "next/server";
import { maskPhone, normalizePhone } from "@/lib/order-flow";
import { createRequest } from "@/lib/store";
import { checkPhoneToken } from "@/lib/verify/phone";

export const runtime = "nodejs";

/**
 * POST /api/requests. An owner who is stuck (usually at KYC) asks for help.
 * The request lands in the Accel back office for a partner or salesperson.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const name = String(body?.contact?.name ?? "").trim().slice(0, 80);
  const phone = normalizePhone(String(body?.contact?.phone ?? ""));
  if (!name || !phone) {
    return NextResponse.json({ error: "Name and a valid 10-digit mobile number are required" }, { status: 400 });
  }
  // A partner will ring this number, so make sure it is the owner's.
  if (!checkPhoneToken(phone, body?.phoneToken ?? body?.contact?.phoneToken)) {
    return NextResponse.json({ error: "Verify your mobile number first" }, { status: 403 });
  }

  const reasons = Array.isArray(body?.reasons)
    ? body.reasons.filter((r: unknown) => typeof r === "string").slice(0, 10).map((r: string) => r.slice(0, 200))
    : [];

  const r = await createRequest({
    kind: body?.kind === "callback" ? "callback" : "kyc_help",
    contact: { name, phone },
    business: {
      tradeName: body?.business?.tradeName?.slice?.(0, 120),
      businessType: body?.business?.businessType?.slice?.(0, 60),
      city: body?.business?.city?.slice?.(0, 60),
    },
    reasons,
  });
  console.info(`[request] ${r.id} ${r.kind} from ${maskPhone(phone)}`);
  return NextResponse.json({ id: r.id }, { status: 201 });
}
