import { NextResponse } from "next/server";
import { catalog } from "@/lib/i18n-catalog";
import { isLangCode } from "@/lib/languages";
import { translate } from "@/lib/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/i18n/:lang: the whole fixed UI in one language, keyed by its English text.
 * Hindi comes from the hand-written copy; other languages are translated once and saved.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLangCode(lang)) return NextResponse.json({ error: "Unknown language" }, { status: 404 });

  const texts = catalog();
  if (lang === "en" || lang === "hi") {
    return NextResponse.json({
      lang,
      translations: Object.fromEntries(texts.map((t) => [t.en, t[lang]])),
      complete: true,
    });
  }

  const translations = await translate(
    lang,
    texts.map((t) => t.en),
    true,
  );
  return NextResponse.json({ lang, translations, complete: Object.keys(translations).length === texts.length });
}
