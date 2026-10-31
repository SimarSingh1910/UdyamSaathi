import { NextResponse } from "next/server";
import { BUSINESS_TYPES, recommend, type AdvisorAnswers, type Lang } from "@/lib/advisor";
import { getCatalogue } from "@/lib/catalogue";
import { complete } from "@/lib/llm";
import { buildQuote } from "@/lib/quote";

export const runtime = "nodejs";

const ALL_TYPES = new Set(Object.values(BUSINESS_TYPES).flat());

/**
 * POST /api/advisor/recommend
 * Body: { answers: AdvisorAnswers, lang: "en" | "hi" }
 * Returns the recommended bundle, its quote, and a plain-language pitch.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const a = body?.answers as Partial<AdvisorAnswers> | undefined;
  const lang: Lang = body?.lang === "hi" ? "hi" : "en";

  if (!a || !a.businessType || !ALL_TYPES.has(a.businessType)) {
    return NextResponse.json({ error: "answers.businessType is required" }, { status: 400 });
  }

  const answers: AdvisorAnswers = {
    businessType: a.businessType,
    city: typeof a.city === "string" ? a.city : "",
    employees: Math.min(500, Math.max(1, Number(a.employees) || 1)),
    sites: Math.min(50, Math.max(1, Number(a.sites) || 1)),
    currentInternet: a.currentInternet ?? "Mobile hotspot",
    needs: Array.isArray(a.needs) ? a.needs : [],
    hasGstin: a.hasGstin === true,
  };

  const catalogue = getCatalogue();
  const rec = recommend(answers, catalogue);
  const quote = buildQuote(rec.items, rec.profile, catalogue);

  // GenAI explains the bundle in the owner's language. Prices come from the quote
  // engine, never from the model.
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
      (lang === "hi" ? "Write in simple Hindi (Devanagari)." : "Write in simple English."),
    user: `Business: ${answers.businessType}, ${answers.employees} people, ${answers.sites} location(s), city ${answers.city || "not given"}, currently uses ${answers.currentInternet}.
Bundle:
${lines}
Monthly total incl. GST: Rs ${Math.round(quote.monthlyTotal)}.`,
    timeoutMs: 10_000,
  });

  return NextResponse.json({
    recommendation: rec,
    quote,
    pitch: pitch?.trim() || rec.summary[lang],
    pitchSource: pitch ? "llm" : "rules",
  });
}
