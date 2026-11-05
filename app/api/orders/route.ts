import { NextResponse } from "next/server";
import { normalizePhone } from "@/lib/order-flow";
import { placeOrder, type PlaceOrderInput } from "@/lib/orders";
import { checkPhoneToken } from "@/lib/verify/phone";

export const runtime = "nodejs";

type Body = Omit<PlaceOrderInput, "contact" | "channel"> & {
  /** phoneToken comes from /api/verify and proves the owner has this phone. */
  contact?: { name?: string; phone?: string; phoneToken?: string };
  phoneToken?: string;
  kycApproved?: boolean;
};

/**
 * POST /api/orders. Places an order after KYC. The price is recalculated here
 * from the catalogue; the client's numbers are never trusted.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });

  const name = (body.contact?.name ?? "").trim().slice(0, 80);
  const phone = normalizePhone(body.contact?.phone ?? "");
  if (!name) return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number" }, { status: 400 });
  if (!checkPhoneToken(phone, body.phoneToken ?? body.contact?.phoneToken)) {
    return NextResponse.json({ error: "Verify your mobile number first" }, { status: 403 });
  }
  if (body.kycApproved !== true) return NextResponse.json({ error: "KYC must be completed first" }, { status: 400 });

  const { lang, answers, profile, items, business } = body;
  const r = await placeOrder({ lang, answers, profile, items, business, contact: { name, phone }, channel: "web" });
  if (!r.ok) return NextResponse.json({ error: r.error, issues: r.issues }, { status: 422 });
  return NextResponse.json({ id: r.order.id }, { status: 201 });
}
