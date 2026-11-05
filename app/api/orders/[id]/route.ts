import { NextResponse } from "next/server";
import { maskPhone } from "@/lib/order-flow";
import { getOrder } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/orders/:id. What the owner sees on the tracker. The phone number is masked. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(decodeURIComponent(id));
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json(
    { ...order, contact: { name: order.contact.name, phone: maskPhone(order.contact.phone) } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
