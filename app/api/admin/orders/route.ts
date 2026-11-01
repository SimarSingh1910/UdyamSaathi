import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { maskPhone } from "@/lib/order-flow";
import { listOrders } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/orders: every order, newest first. Phone numbers are masked in lists. */
export function GET(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  const orders = listOrders().map((o) => ({ ...o, contact: { name: o.contact.name, phone: maskPhone(o.contact.phone) } }));
  return NextResponse.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}
