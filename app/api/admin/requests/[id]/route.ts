import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { listRequests, updateRequest, type RequestStatus } from "@/lib/store";

export const runtime = "nodejs";

const STATUSES: RequestStatus[] = ["new", "assigned", "contacted", "resolved"];

/** PATCH /api/admin/requests/:id { status?, assignedTo?, note? } or { action: "reveal_phone" } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const id = (await params).id;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });

  if (body.action === "reveal_phone") {
    const r = listRequests().find((x) => x.id === id);
    return r ? NextResponse.json({ phone: r.contact.phone }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch: Parameters<typeof updateRequest>[1] = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    patch.status = body.status;
  }
  if (typeof body.assignedTo === "string") patch.assignedTo = body.assignedTo.slice(0, 80);
  if (typeof body.note === "string") patch.note = body.note.slice(0, 500);

  const r = updateRequest(id, patch);
  return r ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
