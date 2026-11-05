import { NextResponse } from "next/server";
import { getCatalogue } from "@/lib/catalogue";
import type { BusinessProfile } from "@/lib/eligibility";
import { buildQuote, type QuoteItemInput } from "@/lib/quote";

export const runtime = "nodejs";

interface QuoteRequest {
  profile?: Partial<BusinessProfile>;
  items?: QuoteItemInput[];
}

/**
 * POST /api/quote
 * Body: { profile: { cityTier, employees, sites, hasActiveGstin }, items: [{ productId, quantity }] }
 */
export async function POST(req: Request) {
  let body: QuoteRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const p = body.profile ?? {};
  if (p.cityTier !== 1 && p.cityTier !== 2) {
    return NextResponse.json({ error: "profile.cityTier must be 1 or 2" }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
  }
  if (body.items.length > 50) {
    return NextResponse.json({ error: "Too many items" }, { status: 400 });
  }

  const items = body.items
    .filter((i) => typeof i?.productId === "string")
    .map((i) => ({ productId: i.productId, quantity: Math.min(100, Number(i.quantity) || 0) }));

  const profile: BusinessProfile = {
    cityTier: p.cityTier,
    employees: Math.max(0, Number(p.employees) || 1),
    sites: Math.max(1, Number(p.sites) || 1),
    hasActiveGstin: p.hasActiveGstin === true,
  };

  return NextResponse.json(buildQuote(items, profile, await getCatalogue()));
}
