import { NextResponse } from "next/server";
import type { AdvisorAnswers } from "@/lib/advisor";
import { buildRecommendation, completeAnswers } from "@/lib/recommendation";

export const runtime = "nodejs";

/**
 * POST /api/advisor/recommend
 * Body: { answers: AdvisorAnswers }
 * Returns the recommended bundle, its quote, and a plain-language pitch in English
 * (the client translates it into the owner's language like the rest of the UI).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const answers = completeAnswers(body?.answers as Partial<AdvisorAnswers> | undefined);
  if (!answers) {
    return NextResponse.json({ error: "answers.businessType is required" }, { status: 400 });
  }
  return NextResponse.json(await buildRecommendation(answers));
}
