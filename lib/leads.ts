import { loadDataset } from "./data";
import { getModel, score } from "./propensity";
import { leadActions, type LeadAction } from "./store";

/** Reasons where calling again cannot help. */
const UNREACHABLE = new Set(["Wrong or invalid number"]);

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
  action?: LeadAction;
}

let cache: { leads: ScoredLead[]; segmentValue: Record<string, number> } | null = null;

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/** Dropped leads from the quarter, scored once and cached; follow-up actions are merged live. */
export async function scoredLeads(): Promise<ScoredLead[]> {
  if (!cache) {
    const rows = loadDataset("smb_leads");
    const model = getModel();
    const segmentValue: Record<string, number> = {};
    for (const seg of new Set(rows.map((r) => r.segment))) {
      segmentValue[seg] = median(
        rows.filter((r) => r.segment === seg && r.outcome === "Activated").map((r) => Number(r.monthly_bundle_value_inr)),
      );
    }
    const leads = rows
      .filter((r) => r.outcome !== "Activated" && !UNREACHABLE.has(r.drop_reason))
      .map((r) => {
        const s = score(model, r);
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
      });
    cache = { leads, segmentValue };
  }
  const actions = await leadActions();
  return cache.leads.map((l) => (actions[l.id] ? { ...l, action: actions[l.id] } : l));
}

export function modelSummary() {
  const m = getModel();
  return { holdoutAuc: m.holdoutAuc, baseRate: m.baseRate, trainedOn: m.trainedOn };
}
