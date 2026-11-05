import { loadDataset } from "./data";

/**
 * "Which leads should we call?" A small logistic regression trained on the
 * quarter's 5,000 leads to predict activation from what we know at lead time
 * (profile, source, registrations, current setup). Trained in-process on first
 * use (a few milliseconds), so there is no separate model artefact to manage.
 */

type Row = Record<string, string>;

export const SEGMENTS = ["Micro retail & services", "Professional offices", "Small multi-site businesses", "Small manufacturers"];
export const SOURCES = ["Field sales", "Website form", "Channel partner", "Inbound call", "Referral", "WhatsApp campaign"];
export const INTERNET = ["Mobile hotspot", "Home broadband", "Business broadband", "Leased line", "Mixed per site", "None"];
export const TURNOVER = ["< 40 lakh", "40 lakh - 1.5 cr", "1.5 - 5 cr", "5 - 25 cr", "25 - 100 cr"];

/** Human-readable name for each feature, used to explain a score. */
export const FEATURE_NAMES: string[] = [
  ...SEGMENTS.map((s) => s),
  ...SOURCES.map((s) => `Came via ${s.toLowerCase()}`),
  ...INTERNET.map((s) => `Uses ${s.toLowerCase()}`),
  "Tier 2 city",
  "Has GSTIN",
  "Has Udyam",
  "Staff size",
  "Number of sites",
  "Telecom spend",
  "Products asked about",
  "Turnover",
  "Prefers Hindi/English",
];

function rawFeatures(r: Row): number[] {
  const oneHot = (list: string[], v: string) => list.map((x) => (x === v ? 1 : 0));
  return [
    ...oneHot(SEGMENTS, r.segment),
    ...oneHot(SOURCES, r.lead_source),
    ...oneHot(INTERNET, r.current_internet),
    r.city_tier === "2" ? 1 : 0,
    r.has_gstin === "Y" ? 1 : 0,
    r.has_udyam === "Y" ? 1 : 0,
    Math.log1p(Number(r.employee_count) || 0),
    Math.log1p(Number(r.num_sites) || 0),
    Math.log1p(Number(r.monthly_telecom_spend_inr) || 0),
    (r.products_of_interest || "").split(";").filter(Boolean).length,
    Math.max(0, TURNOVER.indexOf(r.annual_turnover_band)),
    r.preferred_language === "Hindi" || r.preferred_language === "English" ? 1 : 0,
  ];
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Deterministic 80/20 split so the reported accuracy is stable between runs. */
const isHoldout = (leadId: string) => (Number(leadId.replace(/\D/g, "")) * 2654435761) % 100 < 20;

export interface Model {
  weights: number[];
  bias: number;
  mean: number[];
  std: number[];
  /** Area under the ROC curve on the 20% of leads held out from training. */
  holdoutAuc: number;
  baseRate: number;
  trainedOn: number;
}

function auc(scores: number[], labels: number[]): number {
  const pairs = scores.map((s, i) => [s, labels[i]] as const).sort((a, b) => a[0] - b[0]);
  let rankSum = 0;
  let pos = 0;
  pairs.forEach(([, y], i) => {
    if (y === 1) {
      rankSum += i + 1;
      pos++;
    }
  });
  const neg = pairs.length - pos;
  return pos && neg ? (rankSum - (pos * (pos + 1)) / 2) / (pos * neg) : 0.5;
}

export function train(rows: Row[], epochs = 400, lr = 0.3, l2 = 0.001): Model {
  const X = rows.map(rawFeatures);
  const y: number[] = rows.map((r) => (r.outcome === "Activated" ? 1 : 0));
  const train = rows.map((r, i) => i).filter((i) => !isHoldout(rows[i].lead_id));
  const test = rows.map((r, i) => i).filter((i) => isHoldout(rows[i].lead_id));

  const k = X[0].length;
  const mean = Array.from({ length: k }, (_, j) => train.reduce((s, i) => s + X[i][j], 0) / train.length);
  const std = Array.from({ length: k }, (_, j) =>
    Math.sqrt(train.reduce((s, i) => s + (X[i][j] - mean[j]) ** 2, 0) / train.length) || 1,
  );
  const Z = X.map((x) => x.map((v, j) => (v - mean[j]) / std[j]));

  const w = new Array(k).fill(0);
  let b = 0;
  for (let e = 0; e < epochs; e++) {
    const gw = new Array(k).fill(0);
    let gb = 0;
    for (const i of train) {
      const err = sigmoid(Z[i].reduce((s, v, j) => s + v * w[j], b)) - y[i];
      for (let j = 0; j < k; j++) gw[j] += err * Z[i][j];
      gb += err;
    }
    for (let j = 0; j < k; j++) w[j] -= lr * (gw[j] / train.length + l2 * w[j]);
    b -= lr * (gb / train.length);
  }

  const testScores = test.map((i) => sigmoid(Z[i].reduce((s, v, j) => s + v * w[j], b)));
  return {
    weights: w,
    bias: b,
    mean,
    std,
    holdoutAuc: auc(testScores, test.map((i) => y[i])),
    baseRate: y.reduce((s, v) => s + v, 0) / y.length,
    trainedOn: train.length,
  };
}

export interface Score {
  probability: number;
  /** The two features pushing this lead's score up the most. */
  reasons: string[];
}

export function score(model: Model, r: Row): Score {
  const z = rawFeatures(r).map((v, j) => (v - model.mean[j]) / model.std[j]);
  const contrib = z.map((v, j) => v * model.weights[j]);
  const probability = sigmoid(contrib.reduce((s, v) => s + v, model.bias));
  const reasons = contrib
    .map((c, j) => [c, j] as const)
    .filter(([c]) => c > 0.05)
    .sort((a, b) => b[0] - a[0])
    .slice(0, 2)
    .map(([, j]) => FEATURE_NAMES[j]);
  return { probability, reasons };
}

let cached: Model | null = null;
export function getModel(): Model {
  if (!cached) cached = train(loadDataset("smb_leads"));
  return cached;
}
