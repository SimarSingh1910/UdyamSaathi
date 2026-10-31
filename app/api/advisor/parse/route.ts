import { NextResponse } from "next/server";
import { parseAnswers } from "@/lib/advisor-parse";

export const runtime = "nodejs";

/**
 * POST /api/advisor/parse
 * Body: { message } — the owner describes the business in their own words.
 * Returns whatever answers could be understood; the UI asks for the rest.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });

  const { answers, source } = await parseAnswers(message);
  return NextResponse.json({ answers, source });
}
