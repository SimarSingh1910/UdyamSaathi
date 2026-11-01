import type { SegmentCode } from "./catalogue";
import type { StoredProduct } from "./store";

const SEGMENTS: SegmentCode[] = ["micro", "prof", "multi", "mfg"];
export const PRODUCT_UNITS = ["per site", "per line", "per user", "per device", "per camera", "per account", "per pack", "per number", "per channel", "per IP", "per counter", "per vehicle"];
export const PRODUCT_CATEGORIES = ["Connectivity", "Communication", "Cloud & Productivity", "Security", "IoT & Physical"];

/** Validate a product coming from the back-office form. Returns the product or a list of problems. */
export function parseProductInput(
  input: Record<string, unknown>,
  id: string,
  existingIds: Set<string>,
): { product?: StoredProduct; errors: string[] } {
  const errors: string[] = [];
  const str = (k: string, max = 200) => (typeof input[k] === "string" ? (input[k] as string).trim().slice(0, max) : "");
  const num = (k: string, min = 0) => {
    const n = Number(input[k]);
    if (!Number.isFinite(n) || n < min) errors.push(`${k} must be a number of at least ${min}`);
    return Number.isFinite(n) ? n : 0;
  };
  const list = <T>(k: string) => (Array.isArray(input[k]) ? (input[k] as T[]) : []);

  const name = str("name", 80);
  if (!name) errors.push("name is required");
  const category = str("category", 40) || "Connectivity";
  const unit = str("unit", 30) || "per account";
  const priceMin = num("priceMin", 0);
  const priceMax = num("priceMax", 0);
  if (priceMax < priceMin) errors.push("priceMax must be at least priceMin");

  const cityTiers = list<number>("cityTiers").map(Number).filter((t) => t === 1 || t === 2);
  if (!cityTiers.length) errors.push("pick at least one city tier");

  const requiresOneOf = list<string>("requiresOneOf").filter((x) => typeof x === "string" && x !== id);
  const unknown = requiresOneOf.filter((x) => !existingIds.has(x));
  if (unknown.length) errors.push(`unknown dependency: ${unknown.join(", ")}`);

  const targetSegments = list<SegmentCode>("targetSegments").filter((s) => SEGMENTS.includes(s));

  if (errors.length) return { errors };
  return {
    errors,
    product: {
      id,
      name,
      category,
      description: str("description", 300),
      unit,
      priceMin,
      priceMax,
      setupFee: num("setupFee", 0),
      minContractMonths: Math.round(num("minContractMonths", 0)),
      cityTiers: [...new Set(cityTiers)].sort(),
      minEmployees: Math.round(num("minEmployees", 0)),
      minSites: Math.max(1, Math.round(num("minSites", 0))),
      requiresGstin: input.requiresGstin === true,
      requiresOneOf,
      installDays: Math.round(num("installDays", 0)),
      targetSegments,
      active: input.active !== false,
    },
  };
}
