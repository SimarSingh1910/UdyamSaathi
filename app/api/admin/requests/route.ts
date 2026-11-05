import { NextResponse } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { maskPhone } from "@/lib/order-flow";
import { listRequests } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/requests: owners who asked for help, newest first. */
export async function GET(req: Request) {
  if (!isAdmin(req)) return unauthorized();
  const requests = (await listRequests()).map((r) => ({ ...r, contact: { name: r.contact.name, phone: maskPhone(r.contact.phone) } }));
  return NextResponse.json({ requests });
}
