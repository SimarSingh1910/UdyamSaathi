import { describe, expect, it } from "vitest";
import { getCatalogue, getProduct } from "@/lib/catalogue";
import { checkProductEligibility, validateBundle, type BusinessProfile } from "@/lib/eligibility";
import { buildQuote } from "@/lib/quote";

const kirana: BusinessProfile = { cityTier: 2, employees: 2, sites: 1, hasActiveGstin: false };
const clinic: BusinessProfile = { cityTier: 1, employees: 12, sites: 1, hasActiveGstin: true };

describe("catalogue", () => {
  it("loads all 25 products with parsed rules", () => {
    const catalogue = getCatalogue();
    expect(catalogue).toHaveLength(25);
    const staticIp = getProduct("P11")!;
    expect(staticIp.requiresOneOf).toEqual(["P01", "P02", "P03"]);
    expect(getProduct("P03")!.cityTiers).toEqual([1]);
  });
});

describe("eligibility", () => {
  it("blocks GSTIN-only products for a business without an active GSTIN", () => {
    const res = checkProductEligibility(getProduct("P15")!, kirana);
    expect(res.eligible).toBe(false);
    expect(res.reasons.join(" ")).toMatch(/GST/);
  });

  it("blocks tier-1-only products in tier 2 cities", () => {
    const res = checkProductEligibility(getProduct("P03")!, { ...clinic, cityTier: 2 });
    expect(res.eligible).toBe(false);
  });

  it("blocks multi-site products for a single-site business", () => {
    const res = checkProductEligibility(getProduct("P10")!, clinic);
    expect(res.reasons.join(" ")).toMatch(/3\+ locations/);
  });

  it("flags a missing connectivity dependency and suggests eligible fixes", () => {
    const issues = validateBundle(["P23"], kirana, getCatalogue());
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("missing_dependency");
    // P03, P05, P06 need a GSTIN / more staff, so only fibre 100/300 and AirFiber are suggested.
    expect(issues[0].suggestions).toEqual(["P01", "P02", "P04"]);
  });

  it("accepts a valid bundle", () => {
    expect(validateBundle(["P01", "P23", "P07"], kirana, getCatalogue())).toEqual([]);
  });
});

describe("quote", () => {
  it("prices a single product at list price", () => {
    const q = buildQuote([{ productId: "P01", quantity: 1 }], kirana, getCatalogue());
    expect(q.pricingTier).toBe("single");
    expect(q.monthlySubtotal).toBe(1199);
    expect(q.monthlySavings).toBe(0);
  });

  it("gives bottom-of-range prices for a 4+ product bundle and adds GST", () => {
    const q = buildQuote(
      [
        { productId: "P02", quantity: 1 },
        { productId: "P08", quantity: 3 },
        { productId: "P16", quantity: 12 },
        { productId: "P20", quantity: 12 },
      ],
      clinic,
      getCatalogue(),
    );
    expect(q.pricingTier).toBe("full_bundle");
    // 1499 + 3*599 + 12*125 + 12*99
    expect(q.monthlySubtotal).toBe(1499 + 1797 + 1500 + 1188);
    expect(q.monthlyGst).toBeCloseTo(q.monthlySubtotal * 0.18, 2);
    expect(q.monthlySavings).toBeGreaterThan(0);
    expect(q.contractMonths).toBe(12);
    expect(q.expectedActivationDays).toBe(5);
    expect(q.ready).toBe(true);
  });

  it("merges duplicate items and counts setup fees per unit", () => {
    const q = buildQuote(
      [
        { productId: "P01", quantity: 1 },
        { productId: "P23", quantity: 2 },
        { productId: "P23", quantity: 1 },
      ],
      kirana,
      getCatalogue(),
    );
    const cctv = q.lines.find((l) => l.productId === "P23")!;
    expect(cctv.quantity).toBe(3);
    expect(cctv.setup).toBe(3 * 1800);
  });

  it("is not ready when the bundle has issues", () => {
    const q = buildQuote([{ productId: "P11", quantity: 1 }], kirana, getCatalogue());
    expect(q.ready).toBe(false);
    expect(q.issues[0].type).toBe("missing_dependency");
  });
});
