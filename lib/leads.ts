import { BUSINESS_TYPES, CITY_TIERS, segmentFor } from "./advisor";
import { SEGMENT_CODES } from "./catalogue";
import { loadDataset } from "./data";
import { maskPhone, normalizePhone } from "./order-flow";
import { INTERNET, SOURCES, TURNOVER, getModel, score } from "./propensity";
import { hiddenLeadIds, leadActions, listAddedLeads, type AddedLead, type LeadAction } from "./store";

/** Reasons where calling again cannot help. */
const UNREACHABLE = new Set(["Wrong or invalid number"]);

/** Stage shown for leads added by staff, before anyone has worked on them. */
export const NEW_LEAD_STAGE = "New lead";

export interface ScoredLead {
  id: string;
  createdDate: string;
  businessName: string;
  businessType: string;
  segment: string;
  city: string;
  cityTier: number;
  language: string;
  source: string;
  stageReached: string;
  dropReason: string;
  hasGstin: boolean;
  contactName: string;
  probability: number;
  reasons: string[];
  /** Probability x typical monthly bundle value for the segment. */
  expectedMonthly: number;
  /** Added by Accel staff rather than from the quarter's dataset. */
  added?: boolean;
  /** Masked; only staff-added leads can have a number. */
  phoneMasked?: string;
  action?: LeadAction;
}

type Row = Record<string, string>;

let cache: { leads: ScoredLead[]; segmentValue: Record<string, number>; languages: string[] } | null = null;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

function scoreRow(r: Row, segmentValue: Record<string, number>): ScoredLead {
  const s = score(getModel(), r);
  return {
    id: r.lead_id,
    createdDate: r.created_date,
    businessName: r.business_name,
    businessType: r.business_type,
    segment: r.segment,
    city: r.city,
    cityTier: Number(r.city_tier),
    language: r.preferred_language,
    source: r.lead_source,
    stageReached: r.stage_reached,
    dropReason: r.drop_reason,
    hasGstin: r.has_gstin === "Y",
    contactName: r.contact_name,
    probability: s.probability,
    reasons: s.reasons,
    expectedMonthly: Math.round(s.probability * (segmentValue[r.segment] ?? 0)),
  };
}

/** Dropped leads from the quarter, scored once and cached. */
function datasetLeads() {
  if (!cache) {
    const rows = loadDataset("smb_leads");
    const segmentValue: Record<string, number> = {};
    for (const seg of new Set(rows.map((r) => r.segment))) {
      segmentValue[seg] = median(
        rows.filter((r) => r.segment === seg && r.outcome === "Activated").map((r) => Number(r.monthly_bundle_value_inr)),
      );
    }
    const leads = rows
      .filter((r) => r.outcome !== "Activated" && !UNREACHABLE.has(r.drop_reason))
      .map((r) => scoreRow(r, segmentValue));
    const languages = [...new Set(rows.map((r) => r.preferred_language))].sort();
    cache = { leads, segmentValue, languages };
  }
  return cache;
}

const scoreAdded = (l: AddedLead, segmentValue: Record<string, number>): ScoredLead => ({
  ...scoreRow(l.data, segmentValue),
  added: true,
  phoneMasked: l.phone ? maskPhone(l.phone) : undefined,
});

/** Leads to call back: staff-added ones first, then the dataset's, minus deleted ones, with follow-ups merged live. */
export async function scoredLeads(): Promise<ScoredLead[]> {
  const { leads, segmentValue } = datasetLeads();
  const [added, hidden, actions] = await Promise.all([listAddedLeads(), hiddenLeadIds(), leadActions()]);
  return [...added.map((l) => scoreAdded(l, segmentValue)), ...leads.filter((l) => !hidden.has(l.id))].map((l) =>
    actions[l.id] ? { ...l, action: actions[l.id] } : l,
  );
}

export const isDatasetLeadId = (id: string) => /^L\d{5}$/.test(id) && datasetLeads().leads.some((l) => l.id === id);
export const isAddedLeadId = (id: string) => /^LA\d{6}$/.test(id);

/** Choices for the "Add lead" form. */
export function leadFormOptions() {
  return {
    businessTypes: Object.values(BUSINESS_TYPES).flat(),
    sources: SOURCES,
    internet: INTERNET,
    turnover: TURNOVER,
    languages: datasetLeads().languages,
  };
}

const SEGMENT_NAMES = Object.fromEntries(Object.entries(SEGMENT_CODES).map(([name, code]) => [code, name]));

export interface NewLeadInput {
  businessName?: unknown;
  businessType?: unknown;
  city?: unknown;
  contactName?: unknown;
  phone?: unknown;
  language?: unknown;
  source?: unknown;
  employees?: unknown;
  sites?: unknown;
  hasGstin?: unknown;
  hasUdyam?: unknown;
  currentInternet?: unknown;
  telecomSpend?: unknown;
  turnover?: unknown;
  note?: unknown;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const oneOf = (v: unknown, list: readonly string[], fallback: string) => (typeof v === "string" && list.includes(v) ? v : fallback);

/** Checks a new lead from the form and turns it into a dataset-shaped row the model can score. */
export function newLeadRow(input: NewLeadInput): { ok: true; row: Row; phone?: string } | { ok: false; error: string } {
  const businessName = str(input.businessName, 120);
  const contactName = str(input.contactName, 80);
  const city = str(input.city, 60);
  if (!businessName) return { ok: false, error: "Business name is required" };
  if (!contactName) return { ok: false, error: "Contact name is required" };
  if (!city) return { ok: false, error: "City is required" };
  const opts = leadFormOptions();
  const businessType = oneOf(input.businessType, opts.businessTypes, "");
  if (!businessType) return { ok: false, error: "Pick a business type" };

  let phone: string | undefined;
  if (str(input.phone, 20)) {
    phone = normalizePhone(str(input.phone, 20)) ?? undefined;
    if (!phone) return { ok: false, error: "Enter a valid 10-digit Indian mobile number" };
  }

  const sites = int(input.sites, 1, 500, 1);
  const row: Row = {
    lead_id: "",
    created_date: new Date().toISOString().slice(0, 10),
    lead_source: oneOf(input.source, opts.sources, "Field sales"),
    business_name: businessName,
    business_type: businessType,
    segment: SEGMENT_NAMES[segmentFor({ businessType, sites })],
    city,
    city_tier: String(CITY_TIERS[city] ?? 2),
    preferred_language: oneOf(input.language, opts.languages, "Hindi"),
    employee_count: String(int(input.employees, 1, 10_000, 1)),
    num_sites: String(sites),
    annual_turnover_band: oneOf(input.turnover, opts.turnover, TURNOVER[0]),
    has_gstin: input.hasGstin === true ? "Y" : "N",
    has_udyam: input.hasUdyam === true ? "Y" : "N",
    current_internet: oneOf(input.currentInternet, opts.internet, "Mobile hotspot"),
    monthly_telecom_spend_inr: String(int(input.telecomSpend, 0, 10_000_000, 0)),
    products_of_interest: "",
    contact_name: contactName,
    stage_reached: NEW_LEAD_STAGE,
    outcome: "Open",
    drop_reason: str(input.note, 300) || "Added by Accel staff",
  };
  return { ok: true, row, phone };
}

export function modelSummary() {
  const m = getModel();
  return { holdoutAuc: m.holdoutAuc, baseRate: m.baseRate, trainedOn: m.trainedOn };
}
