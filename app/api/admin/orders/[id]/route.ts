import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import {
  STATUS_FLOW,
  applyLineStatus,
  applyStatus,
  isOpen,
  maskPhone,
  nextStatus,
  scheduleInstall,
} from "@/lib/order-flow";
import { getOrder, updateOrder, type LineStatus, type OrderStatus } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action =
  | { action: "advance" }
  | { action: "status"; status: OrderStatus }
  | { action: "line"; productId: string; status: LineStatus }
  | { action: "schedule"; date: string; engineer?: string }
  | { action: "note"; text: string }
  | { action: "cancel"; reason?: string }
  | { action: "reveal_phone" };

const masked = (o: NonNullable<ReturnType<typeof getOrder>>) => ({
  ...o,
  contact: { name: o.contact.name, phone: maskPhone(o.contact.phone) },
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const o = getOrder((await params).id);
  return o ? NextResponse.json(masked(o)) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** PATCH /api/admin/orders/:id. Every change is written to the order's event log. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const id = (await params).id;
  const body = (await req.json().catch(() => null)) as Action | null;
  const current = getOrder(id);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!body?.action) return NextResponse.json({ error: "action is required" }, { status: 400 });

  if (body.action === "reveal_phone") {
    // Seeing the full number is logged, so access to personal data is traceable.
    updateOrder(id, (o) =>
      o.events.push({ at: Date.now(), by: "accel", note: { en: "Contact number viewed by Accel staff", hi: "Accel स्टाफ़ ने संपर्क नंबर देखा" } }),
    );
    return NextResponse.json({ phone: current.contact.phone });
  }

  if (!isOpen(current.status) && body.action !== "note") {
    return NextResponse.json({ error: `Order is ${current.status}; only notes can be added.` }, { status: 409 });
  }

  let error: string | null = null;
  const updated = updateOrder(id, (o) => {
    switch (body.action) {
      case "advance": {
        const next = nextStatus(o.status);
        if (next) applyStatus(o, next, "accel");
        break;
      }
      case "status":
        if (!STATUS_FLOW.includes(body.status)) error = "Unknown status";
        else applyStatus(o, body.status, "accel");
        break;
      case "line":
        if (!["pending", "installing", "active"].includes(body.status)) error = "Unknown line status";
        else applyLineStatus(o, body.productId, body.status, "accel");
        break;
      case "schedule":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "")) error = "date must be YYYY-MM-DD";
        else scheduleInstall(o, body.date, (body.engineer ?? "").slice(0, 60), "accel");
        break;
      case "note": {
        const text = (body.text ?? "").trim().slice(0, 500);
        if (!text) error = "Note is empty";
        else o.events.push({ at: Date.now(), by: "accel", note: { en: text, hi: text } });
        break;
      }
      case "cancel": {
        const reason = (body.reason ?? "").trim().slice(0, 200);
        applyStatus(o, "cancelled", "accel", {
          en: `Cancelled${reason ? `: ${reason}` : ""}`,
          hi: `रद्द${reason ? `: ${reason}` : ""}`,
        });
        break;
      }
      default:
        error = "Unknown action";
    }
  });

  if (error) return NextResponse.json({ error }, { status: 400 });
  return NextResponse.json(masked(updated!));
}
