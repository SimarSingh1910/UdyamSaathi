import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { setLeadAction, type LeadActionStatus } from "@/lib/store";

export const runtime = "nodejs";

const STATUSES: LeadActionStatus[] = ["to_call", "called", "won", "not_interested"];

/** PATCH /api/admin/leads/:id { status?, assignedTo?, note? }: record follow-up on a dropped lead. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return unauthorized();
  const id = (await params).id;
  if (!/^L\d{5}$/.test(id)) return NextResponse.json({ error: "Unknown lead" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  }

  const action = setLeadAction(id, {
    ...(body.status ? { status: body.status } : {}),
    ...(typeof body.assignedTo === "string" ? { assignedTo: body.assignedTo.slice(0, 80) } : {}),
    ...(typeof body.note === "string" ? { note: body.note.slice(0, 500) } : {}),
  });
  return NextResponse.json(action);
}
