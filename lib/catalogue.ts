import { listProducts } from "./store";

export type SegmentCode = "micro" | "prof" | "multi" | "mfg";

export interface Product {
  id: string;
  category: string;
  name: string;
  description: string;
  unit: string;
  priceMin: number;
  priceMax: number;
  setupFee: number;
  minContractMonths: number;
  cityTiers: number[];
  minEmployees: number;
  minSites: number;
  requiresGstin: boolean;
  /** Product needs at least one of these in the same bundle. Empty = no dependency. */
  requiresOneOf: string[];
  installDays: number;
  targetSegments: SegmentCode[];
}

/** Segment names used in smb_leads.csv mapped to the catalogue's short codes. */
export const SEGMENT_CODES: Record<string, SegmentCode> = {
  "Micro retail & services": "micro",
  "Professional offices": "prof",
  "Small multi-site businesses": "multi",
  "Small manufacturers": "mfg",
};

const splitList = (value: string, sep: string) =>
  value
    .split(sep)
    .map((v) => v.trim())
    .filter(Boolean);

export function parseProduct(row: Record<string, string>): Product {
  return {
    id: row.product_id,
    category: row.category,
    name: row.product_name,
    description: row.description,
    unit: row.unit,
    priceMin: Number(row.price_min_inr_per_month),
    priceMax: Number(row.price_max_inr_per_month),
    setupFee: Number(row.one_time_setup_inr || 0),
    minContractMonths: Number(row.min_contract_months || 0),
    cityTiers: splitList(row.available_city_tiers, ";").map(Number),
    minEmployees: Number(row.min_employees || 0),
    minSites: Number(row.min_sites || 0),
    requiresGstin: row.requires_gstin === "Y",
    requiresOneOf: splitList(row.requires_one_of, "|"),
    installDays: Number(row.typical_install_days || 0),
    targetSegments: splitList(row.target_segments, ";") as SegmentCode[],
  };
}

/**
 * Products currently on sale. Seeded from product_catalogue.csv on first run;
 * Accel staff can add, edit, hide or delete them from the back office.
 */
export function getCatalogue(): Product[] {
  return listProducts(false);
}

export function getProduct(id: string): Product | undefined {
  return getCatalogue().find((p) => p.id === id);
}
