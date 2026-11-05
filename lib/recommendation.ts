import { BUSINESS_TYPES, recommend, type AdvisorAnswers, type Recommendation } from "./advisor";
import { getCatalogue } from "./catalogue";
import type { Text } from "./i18n";
import { complete } from "./llm";
import { buildQuote, type Quote } from "./quote";

const ALL_TYPES = new Set(Object.values(BUSINESS_TYPES).flat());

export interface RecommendationResult {
  recommendation: Recommendation;
  quote: Quote;
  /** Written by the LLM in English; callers translate it like the rest of the copy. */
  pitch: string | null;
  summary: Text;
}

/** Fill gaps in partial answers with safe defaults. Null if the business type is unknown. */
export function completeAnswers(a: Partial<AdvisorAnswers> | undefined): AdvisorAnswers | null {
  if (!a || !a.businessType || !ALL_TYPES.has(a.businessType)) return null;
  return {
    businessType: a.businessType,
    city: typeof a.city === "string" ? a.city : "",
    employees: Math.min(500, Math.max(1, Number(a.employees) || 1)),
    sites: Math.min(50, Math.max(1, Number(a.sites) || 1)),
    currentInternet: a.currentInternet ?? "Mobile hotspot",
    needs: Array.isArray(a.needs) ? a.needs : [],
    hasGstin: a.hasGstin === true,
  };
}

/**
 * The bundle, its price and a plain-language pitch. Products come from the rules
 * and prices from the quote engine; the LLM only writes the explanation.
 */
export async function buildRecommendation(answers: AdvisorAnswers): Promise<RecommendationResult> {
  const catalogue = await getCatalogue();
  const rec = recommend(answers, catalogue);
  const quote = buildQuote(rec.items, rec.profile, catalogue);

  const lines = rec.items
    .map((i) => {
      const p = catalogue.find((x) => x.id === i.productId)!;
      return `- ${p.name} x${i.quantity}: ${i.why.en}`;
    })
    .join("\n");
  const pitch = await complete({
    system:
      "You are a friendly advisor for Accel Business helping a small-business owner in India. " +
      "Explain the recommended bundle in 3-4 short sentences of plain, warm language, no jargon or product codes. " +
      "Say how it helps their business day to day. Do not mention any price or number not given to you. " +
      "Write in simple English that translates well.",
    user: `Business: ${answers.businessType}, ${answers.employees} people, ${answers.sites} location(s), city ${answers.city || "not given"}, currently uses ${answers.currentInternet}.
Bundle:
${lines}
Monthly total incl. GST: Rs ${Math.round(quote.monthlyTotal)}.`,
    timeoutMs: 10_000,
  });

  return { recommendation: rec, quote, pitch: pitch?.trim() || null, summary: rec.summary };
}
