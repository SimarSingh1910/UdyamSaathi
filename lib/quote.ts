import type { Product } from "./catalogue";
import { validateBundle, type BundleIssue, type BusinessProfile } from "./eligibility";

export const GST_RATE = 0.18;

export interface QuoteItemInput {
  productId: string;
  quantity: number;
}

export interface QuoteLine {
  productId: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  /** Monthly price per unit after bundle pricing, excl. GST. */
  unitPrice: number;
  /** Monthly price per unit if bought on its own, excl. GST. */
  listPrice: number;
  monthly: number;
  setup: number;
  minContractMonths: number;
  installDays: number;
}

export interface Quote {
  lines: QuoteLine[];
  pricingTier: "single" | "bundle" | "full_bundle";
  monthlySubtotal: number;
  monthlyGst: number;
  monthlyTotal: number;
  setupSubtotal: number;
  setupGst: number;
  setupTotal: number;
  /** Monthly saving vs. buying each product on its own. */
  monthlySavings: number;
  /** The longest minimum contract in the bundle. */
  contractMonths: number;
  /** Installs run in parallel, so the slowest product decides activation. */
  expectedActivationDays: number;
  issues: BundleIssue[];
  /** True when the bundle can be checked out as is. */
  ready: boolean;
}

/**
 * Bundle pricing, kept simple so the owner can see why the price moves:
 * - 1 product: top of the catalogue price range (list price)
 * - 2-3 products: middle of the range
 * - 4+ products: bottom of the range
 */
export function pricingTierFor(distinctProducts: number): Quote["pricingTier"] {
  if (distinctProducts >= 4) return "full_bundle";
  if (distinctProducts >= 2) return "bundle";
  return "single";
}

export function unitPriceFor(product: Product, tier: Quote["pricingTier"]): number {
  if (tier === "full_bundle") return product.priceMin;
  if (tier === "bundle") return Math.round((product.priceMin + product.priceMax) / 2);
  return product.priceMax;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildQuote(
  items: QuoteItemInput[],
  profile: BusinessProfile,
  catalogue: Product[],
): Quote {
  const byId = new Map(catalogue.map((p) => [p.id, p]));

  // Merge duplicate product IDs and drop anything with no quantity.
  const merged = new Map<string, number>();
  for (const item of items) {
    const qty = Math.floor(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + qty);
  }

  const known = [...merged.keys()].filter((id) => byId.has(id));
  const tier = pricingTierFor(known.length);

  const lines: QuoteLine[] = known.map((id) => {
    const p = byId.get(id)!;
    const quantity = merged.get(id)!;
    const unitPrice = unitPriceFor(p, tier);
    return {
      productId: p.id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      quantity,
      unitPrice,
      listPrice: p.priceMax,
      monthly: unitPrice * quantity,
      setup: p.setupFee * quantity,
      minContractMonths: p.minContractMonths,
      installDays: p.installDays,
    };
  });

  const monthlySubtotal = lines.reduce((s, l) => s + l.monthly, 0);
  const setupSubtotal = lines.reduce((s, l) => s + l.setup, 0);
  const listSubtotal = lines.reduce((s, l) => s + l.listPrice * l.quantity, 0);
  const monthlyGst = round2(monthlySubtotal * GST_RATE);
  const setupGst = round2(setupSubtotal * GST_RATE);
  const issues = validateBundle([...merged.keys()], profile, catalogue);

  return {
    lines,
    pricingTier: tier,
    monthlySubtotal,
    monthlyGst,
    monthlyTotal: round2(monthlySubtotal + monthlyGst),
    setupSubtotal,
    setupGst,
    setupTotal: round2(setupSubtotal + setupGst),
    monthlySavings: listSubtotal - monthlySubtotal,
    contractMonths: Math.max(0, ...lines.map((l) => l.minContractMonths)),
    expectedActivationDays: Math.max(0, ...lines.map((l) => l.installDays)),
    issues,
    ready: lines.length > 0 && issues.length === 0,
  };
}
