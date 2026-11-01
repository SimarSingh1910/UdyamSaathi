import { NextResponse } from "next/server";
import { BUSINESS_TYPES, CITY_TIERS, segmentFor } from "@/lib/advisor";
import { getCatalogue } from "@/lib/catalogue";
import type { BusinessProfile } from "@/lib/eligibility";
import { STATUS_LABEL, maskPhone, normalizePhone } from "@/lib/order-flow";
import { buildQuote } from "@/lib/quote";
import { createOrder, newOrderId, type Order } from "@/lib/store";

export const runtime = "nodejs";

interface Body {
  lang?: "en" | "hi";
  answers?: { businessType?: string; city?: string; employees?: number; sites?: number };
  profile?: Partial<BusinessProfile>;
  items?: { productId: string; quantity: number }[];
  business?: { tradeName?: string; legalName?: string; gstinMasked?: string };
  contact?: { name?: string; phone?: string };
  kycApproved?: boolean;
}

const ALL_TYPES = new Set(Object.values(BUSINESS_TYPES).flat());

/**
 * POST /api/orders. Places an order after KYC. The price is recalculated here
 * from the catalogue; the client's numbers are never trusted.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });

  const name = (body.contact?.name ?? "").trim().slice(0, 80);
  const phone = normalizePhone(body.contact?.phone ?? "");
  if (!name) return NextResponse.json({ error: "Contact name is required" }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number" }, { status: 400 });
  if (body.kycApproved !== true) return NextResponse.json({ error: "KYC must be completed first" }, { status: 400 });

  const a = body.answers ?? {};
  const businessType = a.businessType && ALL_TYPES.has(a.businessType) ? a.businessType : "Kirana store";
  const city = typeof a.city === "string" ? a.city.slice(0, 60) : "";
  const p = body.profile ?? {};
  const profile: BusinessProfile = {
    cityTier: p.cityTier === 1 || p.cityTier === 2 ? p.cityTier : CITY_TIERS[city] ?? 2,
    employees: Math.max(1, Number(p.employees) || Number(a.employees) || 1),
    sites: Math.max(1, Number(p.sites) || Number(a.sites) || 1),
    hasActiveGstin: p.hasActiveGstin === true,
  };

  const items = (body.items ?? []).filter((i) => typeof i?.productId === "string").slice(0, 50);
  const quote = buildQuote(items, profile, getCatalogue());
  if (!quote.ready) {
    return NextResponse.json({ error: "This bundle can't be ordered as is", issues: quote.issues }, { status: 422 });
  }

  const now = Date.now();
  // Only the masked GSTIN ever reaches the order record.
  const gstinMasked = body.business?.gstinMasked?.replace(/[^0-9A-Z*]/g, "").slice(0, 15) || undefined;
  const order: Order = {
    id: newOrderId(),
    createdAt: now,
    updatedAt: now,
    status: "kyc_verified",
    lang: body.lang === "hi" ? "hi" : "en",
    business: {
      tradeName: (body.business?.tradeName || `${businessType}, ${city || "India"}`).slice(0, 120),
      legalName: body.business?.legalName?.slice(0, 160),
      gstinMasked,
      businessType,
      segment: segmentFor({ businessType, sites: profile.sites }),
      city,
      sites: profile.sites,
      employees: profile.employees,
    },
    contact: { name, phone },
    lines: quote.lines.map((l) => ({
      productId: l.productId,
      name: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      monthly: l.monthly,
      installDays: l.installDays,
      status: "pending",
    })),
    monthlyTotal: quote.monthlyTotal,
    setupTotal: quote.setupTotal,
    contractMonths: quote.contractMonths,
    expectedActivationDays: quote.expectedActivationDays,
    events: [
      { at: now, status: "placed", note: STATUS_LABEL.placed, by: "customer" },
      { at: now, status: "kyc_verified", note: STATUS_LABEL.kyc_verified, by: "system" },
    ],
  };
  createOrder(order);
  console.info(`[order] ${order.id} created for ${maskPhone(phone)} lines=${order.lines.length}`);

  return NextResponse.json({ id: order.id }, { status: 201 });
}
