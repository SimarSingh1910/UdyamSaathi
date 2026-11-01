import { NextResponse } from "next/server";
import { isLangCode } from "@/lib/languages";
import { translate } from "@/lib/translate";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/translate { lang, texts: string[] }: translate dynamic copy (advisor
 * reasons, KYC results, order updates). Unknown strings come back untranslated.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!isLangCode(body?.lang)) return NextResponse.json({ error: "Unknown language" }, { status: 400 });
  const texts: string[] = Array.isArray(body?.texts)
    ? body.texts.filter((t: unknown): t is string => typeof t === "string" && t.length > 0 && t.length <= 600).slice(0, 60)
    : [];
  if (!texts.length) return NextResponse.json({ translations: {} });

  return NextResponse.json({ translations: await translate(body.lang, texts) });
}
