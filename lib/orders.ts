import { BUSINESS_TYPES, CITY_TIERS, segmentFor } from "./advisor";
import { getCatalogue } from "./catalogue";
import type { BusinessProfile } from "./eligibility";
import { isLangCode } from "./languages";
import { STATUS_LABEL, maskPhone } from "./order-flow";
import { buildQuote, type Quote } from "./quote";
import { createOrder, newOrderId, type Order } from "./store";

export interface PlaceOrderInput {
  lang?: string;
  answers?: { businessType?: string; city?: string; employees?: number; sites?: number };
  profile?: Partial<BusinessProfile>;
  items?: { productId: string; quantity: number }[];
  business?: { tradeName?: string; legalName?: string; gstinMasked?: string };
  /** Name and an already normalised, already verified 10-digit mobile number. */
  contact: { name: string; phone: string };
  channel: NonNullable<Order["channel"]>;
}

export type PlaceOrderResult =
  | { ok: true; order: Order; quote: Quote }
  | { ok: false; error: string; issues?: Quote["issues"] };

const ALL_TYPES = new Set(Object.values(BUSINESS_TYPES).flat());

/**
 * Creates an order after KYC. The price is recalculated here from the catalogue;
 * numbers from the client are never trusted. Shared by the web app and WhatsApp.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const a = input.answers ?? {};
  const businessType = a.businessType && ALL_TYPES.has(a.businessType) ? a.businessType : "Kirana store";
  const city = typeof a.city === "string" ? a.city.slice(0, 60) : "";
  const p = input.profile ?? {};
  const profile: BusinessProfile = {
    cityTier: p.cityTier === 1 || p.cityTier === 2 ? p.cityTier : CITY_TIERS[city] ?? 2,
    employees: Math.max(1, Number(p.employees) || Number(a.employees) || 1),
    sites: Math.max(1, Number(p.sites) || Number(a.sites) || 1),
    hasActiveGstin: p.hasActiveGstin === true,
  };

  const items = (input.items ?? []).filter((i) => typeof i?.productId === "string").slice(0, 50);
  const quote = buildQuote(items, profile, await getCatalogue());
  if (!quote.ready) return { ok: false, error: "This bundle can't be ordered as is", issues: quote.issues };

  const now = Date.now();
  // Only the masked GSTIN ever reaches the order record.
  const gstinMasked = input.business?.gstinMasked?.replace(/[^0-9A-Z*]/g, "").slice(0, 15) || undefined;
  const order: Order = {
    id: await newOrderId(),
    createdAt: now,
    updatedAt: now,
    status: "kyc_verified",
    lang: isLangCode(input.lang) ? input.lang : "en",
    business: {
      tradeName: (input.business?.tradeName || `${businessType}, ${city || "India"}`).slice(0, 120),
      legalName: input.business?.legalName?.slice(0, 160),
      gstinMasked,
      businessType,
      segment: segmentFor({ businessType, sites: profile.sites }),
      city,
      sites: profile.sites,
      employees: profile.employees,
    },
    contact: { name: input.contact.name.trim().slice(0, 80), phone: input.contact.phone },
    channel: input.channel,
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
  await createOrder(order);
  console.info(`[order] ${order.id} created via ${input.channel} for ${maskPhone(order.contact.phone)} lines=${order.lines.length}`);
  return { ok: true, order, quote };
}
