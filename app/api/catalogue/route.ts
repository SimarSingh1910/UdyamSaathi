import { NextResponse, type NextRequest } from "next/server";
import { getCatalogue } from "@/lib/catalogue";
import { checkProductEligibility, type BusinessProfile } from "@/lib/eligibility";

export const runtime = "nodejs";

/**
 * GET /api/catalogue
 * Optional query: tier=1|2&employees=N&sites=N&gstin=active
 * With a profile, each product also carries `eligibility`.
 */
export function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const catalogue = getCatalogue();

  if (!q.has("tier")) {
    return NextResponse.json({ products: catalogue });
  }

  const tier = Number(q.get("tier"));
  if (tier !== 1 && tier !== 2) {
    return NextResponse.json({ error: "tier must be 1 or 2" }, { status: 400 });
  }

  const profile: BusinessProfile = {
    cityTier: tier,
    employees: Math.max(0, Number(q.get("employees") ?? 1) || 1),
    sites: Math.max(1, Number(q.get("sites") ?? 1) || 1),
    hasActiveGstin: q.get("gstin") === "active",
  };

  return NextResponse.json({
    profile,
    products: catalogue.map((p) => ({ ...p, eligibility: checkProductEligibility(p, profile) })),
  });
}
