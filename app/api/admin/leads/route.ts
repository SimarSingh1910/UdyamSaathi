import { NextResponse, type NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { modelSummary, scoredLeads } from "@/lib/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/leads?segment=&city=&stage=&status=&sort=probability|value&limit=&offset=
 * Leads that dropped out, ranked by how likely they are to convert if called.
 */
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return unauthorized();
  const q = req.nextUrl.searchParams;

  let leads = await scoredLeads();
  const filters = { segment: q.get("segment"), city: q.get("city"), stage: q.get("stage"), status: q.get("status") };
  if (filters.segment) leads = leads.filter((l) => l.segment === filters.segment);
  if (filters.city) leads = leads.filter((l) => l.city === filters.city);
  if (filters.stage) leads = leads.filter((l) => l.stageReached === filters.stage);
  if (filters.status === "open") leads = leads.filter((l) => !l.action || l.action.status === "to_call");
  else if (filters.status) leads = leads.filter((l) => l.action?.status === filters.status);

  const key = q.get("sort") === "value" ? "expectedMonthly" : "probability";
  leads = [...leads].sort((a, b) => b[key] - a[key]);

  const limit = Math.min(200, Math.max(1, Number(q.get("limit")) || 50));
  const offset = Math.max(0, Number(q.get("offset")) || 0);

  const all = await scoredLeads();
  return NextResponse.json({
    total: leads.length,
    leads: leads.slice(offset, offset + limit),
    model: modelSummary(),
    facets: {
      segments: [...new Set(all.map((l) => l.segment))].sort(),
      cities: [...new Set(all.map((l) => l.city))].sort(),
      stages: [...new Set(all.map((l) => l.stageReached))],
    },
  });
}
