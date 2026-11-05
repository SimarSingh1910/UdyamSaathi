import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { isAddedLeadId, isDatasetLeadId } from "@/lib/leads";
import { deleteLead, getAddedLead, setLeadAction, type LeadActionStatus } from "@/lib/store";

export const runtime = "nodejs";

const STATUSES: LeadActionStatus[] = ["to_call", "called", "won", "not_interested"];
const notFound = () => NextResponse.json({ error: "Unknown lead" }, { status: 404 });

async function exists(id: string): Promise<boolean> {
  if (isAddedLeadId(id)) return Boolean(await getAddedLead(id));
  return isDatasetLeadId(id);
}

/**
 * PATCH /api/admin/leads/:id { status?, assignedTo?, note? }: record follow-up on a lead.
 * Or { action: "reveal_phone" } for the number of a lead staff added.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const id = (await params).id;
  if (!(await exists(id))) return notFound();

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  if (body.action === "reveal_phone") {
    const phone = isAddedLeadId(id) ? (await getAddedLead(id))?.phone : undefined;
    return phone ? NextResponse.json({ phone }) : NextResponse.json({ error: "No number for this lead" }, { status: 404 });
  }
  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  }

  const action = await setLeadAction(id, {
    ...(body.status ? { status: body.status } : {}),
    ...(typeof body.assignedTo === "string" ? { assignedTo: body.assignedTo.slice(0, 80) } : {}),
    ...(typeof body.note === "string" ? { note: body.note.slice(0, 500) } : {}),
  });
  return NextResponse.json(action);
}

/** DELETE /api/admin/leads/:id: removes a lead staff added, or hides one from the dataset. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const id = (await params).id;
  if (!(await exists(id))) return notFound();
  await deleteLead(id, !isAddedLeadId(id));
  return NextResponse.json({ ok: true });
}
