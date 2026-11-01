import { NextResponse } from "next/server";
import { QUESTION_ORDER, advisorChat, type ChatTurn } from "@/lib/advisor-chat";
import { cleanAnswers, type QuestionKey } from "@/lib/advisor-parse";
import { isLangCode } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/advisor/chat { history, answers, lang, pending }
 * One conversational turn: the advisor's reply, the facts it picked up, and what to ask next.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });

  const history: ChatTurn[] = Array.isArray(body.history)
    ? body.history
        .filter((t: ChatTurn) => (t?.role === "user" || t?.role === "assistant") && typeof t.content === "string")
        .slice(-12)
    : [];
  if (!history.some((t) => t.role === "user")) {
    return NextResponse.json({ error: "history must include the owner's message" }, { status: 400 });
  }

  const pending = QUESTION_ORDER.includes(body.pending) ? (body.pending as QuestionKey) : null;
  const result = await advisorChat({
    history,
    answers: cleanAnswers(body.answers ?? {}),
    lang: isLangCode(body.lang) ? body.lang : "en",
    pending,
  });
  return NextResponse.json(result);
}
