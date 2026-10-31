import type { Product } from "./catalogue";

/** What we need to know about a business to decide what it can buy. */
export interface BusinessProfile {
  cityTier: 1 | 2;
  employees: number;
  sites: number;
  /** True only when the GSTIN has been looked up and is Active. */
  hasActiveGstin: boolean;
}

export interface EligibilityResult {
  productId: string;
  eligible: boolean;
  /** Plain-language reasons, shown to the owner when a product is unavailable. */
  reasons: string[];
}

/** Rules that depend only on the business, not on the rest of the bundle. */
export function checkProductEligibility(
  product: Product,
  profile: BusinessProfile,
): EligibilityResult {
  const reasons: string[] = [];

  if (!product.cityTiers.includes(profile.cityTier)) {
    reasons.push(`${product.name} is not yet available in tier ${profile.cityTier} cities.`);
  }
  if (profile.employees < product.minEmployees) {
    reasons.push(`${product.name} is offered to businesses with ${product.minEmployees}+ employees.`);
  }
  if (profile.sites < product.minSites) {
    reasons.push(`${product.name} is for businesses with ${product.minSites}+ locations.`);
  }
  if (product.requiresGstin && !profile.hasActiveGstin) {
    reasons.push(`${product.name} needs an active GST registration.`);
  }

  return { productId: product.id, eligible: reasons.length === 0, reasons };
}

export interface BundleIssue {
  productId: string;
  type: "ineligible" | "missing_dependency" | "unknown_product";
  message: string;
  /** For missing dependencies: products that would satisfy the rule. */
  suggestions?: string[];
}

/**
 * Check a whole bundle: every product must be eligible for the business, and
 * every product with a dependency needs at least one of its required products
 * in the same bundle (e.g. Static IP needs a fibre connection).
 */
export function validateBundle(
  productIds: string[],
  profile: BusinessProfile,
  catalogue: Product[],
): BundleIssue[] {
  const byId = new Map(catalogue.map((p) => [p.id, p]));
  const inBundle = new Set(productIds);
  const issues: BundleIssue[] = [];

  for (const id of inBundle) {
    const product = byId.get(id);
    if (!product) {
      issues.push({ productId: id, type: "unknown_product", message: `Unknown product ${id}.` });
      continue;
    }

    const elig = checkProductEligibility(product, profile);
    for (const reason of elig.reasons) {
      issues.push({ productId: id, type: "ineligible", message: reason });
    }

    if (product.requiresOneOf.length > 0 && !product.requiresOneOf.some((d) => inBundle.has(d))) {
      const names = product.requiresOneOf.map((d) => byId.get(d)?.name ?? d);
      issues.push({
        productId: id,
        type: "missing_dependency",
        message: `${product.name} works on top of an internet connection. Add one of: ${names.join(", ")}.`,
        suggestions: product.requiresOneOf.filter((d) => {
          const dep = byId.get(d);
          return dep ? checkProductEligibility(dep, profile).eligible : false;
        }),
      });
    }
  }

  return issues;
}
