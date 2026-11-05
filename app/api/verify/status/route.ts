import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/order-flow";
import { getVerification } from "@/lib/store";
import { issuePhoneToken, verificationIsFor, verificationStatus } from "@/lib/verify/phone";

export const runtime = "nodejs";

/**
 * GET /api/verify/status?id=…&phone=…
 * The browser polls this while waiting for a missed call. Once it has come in, the
 * response carries the token for the order.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const phone = normalizePhone(url.searchParams.get("phone") ?? "");
  const v = await getVerification(id);
  if (!v || !phone || !verificationIsFor(v, phone)) return NextResponse.json({ status: "not_found" }, { status: 404 });

  const status = await verificationStatus(id);
  return NextResponse.json(
    { status, token: status === "verified" ? issuePhoneToken(phone) : undefined },
    { headers: { "Cache-Control": "no-store" } },
  );
}
