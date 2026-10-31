import { readFileSync } from "node:fs";
import path from "node:path";
import { parseCsv } from "./csv";

/** Folder holding the synthetic dataset. Overridable for tests. */
const DATA_DIR = process.env.UDYAM_DATA_DIR ?? path.join(process.cwd(), "data");

export type DatasetName =
  | "product_catalogue"
  | "smb_leads"
  | "mock_gstin_registry"
  | "mock_udyam_registry";

const cache = new Map<DatasetName, Record<string, string>[]>();

/** Load a CSV from data/ once and keep it in memory for the life of the server. */
export function loadDataset(name: DatasetName): Record<string, string>[] {
  const hit = cache.get(name);
  if (hit) return hit;

  const text = readFileSync(path.join(DATA_DIR, `${name}.csv`), "utf8");
  const rows = parseCsv(text);
  cache.set(name, rows);
  return rows;
}

/**
 * "Today" for any date-based rule in the prototype (e.g. address proof age).
 * The dataset README fixes this so results are reproducible.
 */
export const DATASET_TODAY = new Date("2026-07-15T00:00:00+05:30");
