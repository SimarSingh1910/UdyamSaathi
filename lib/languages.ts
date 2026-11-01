/**
 * English plus the 22 languages in the Eighth Schedule of the Constitution of India.
 * Hindi and English copy is written by hand; the rest is machine-translated
 * (see lib/translate.ts) and saved to messages/<code>.json for review.
 */
export const LANGUAGES = [
  { code: "en", english: "English", native: "English", script: "Latin", dir: "ltr", speech: "en-IN" },
  { code: "hi", english: "Hindi", native: "हिन्दी", script: "Devanagari", dir: "ltr", speech: "hi-IN" },
  { code: "bn", english: "Bengali", native: "বাংলা", script: "Bengali", dir: "ltr", speech: "bn-IN" },
  { code: "mr", english: "Marathi", native: "मराठी", script: "Devanagari", dir: "ltr", speech: "mr-IN" },
  { code: "te", english: "Telugu", native: "తెలుగు", script: "Telugu", dir: "ltr", speech: "te-IN" },
  { code: "ta", english: "Tamil", native: "தமிழ்", script: "Tamil", dir: "ltr", speech: "ta-IN" },
  { code: "gu", english: "Gujarati", native: "ગુજરાતી", script: "Gujarati", dir: "ltr", speech: "gu-IN" },
  { code: "ur", english: "Urdu", native: "اردو", script: "Perso-Arabic (Nastaliq)", dir: "rtl", speech: "ur-IN" },
  { code: "kn", english: "Kannada", native: "ಕನ್ನಡ", script: "Kannada", dir: "ltr", speech: "kn-IN" },
  { code: "or", english: "Odia", native: "ଓଡ଼ିଆ", script: "Odia", dir: "ltr", speech: "or-IN" },
  { code: "ml", english: "Malayalam", native: "മലയാളം", script: "Malayalam", dir: "ltr", speech: "ml-IN" },
  { code: "pa", english: "Punjabi", native: "ਪੰਜਾਬੀ", script: "Gurmukhi", dir: "ltr", speech: "pa-IN" },
  { code: "as", english: "Assamese", native: "অসমীয়া", script: "Assamese (Bengali-Assamese)", dir: "ltr", speech: "as-IN" },
  { code: "mai", english: "Maithili", native: "मैथिली", script: "Devanagari", dir: "ltr", speech: "mai-IN" },
  { code: "sat", english: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ", script: "Ol Chiki", dir: "ltr", speech: "sat-IN" },
  { code: "ks", english: "Kashmiri", native: "کٲشُر", script: "Perso-Arabic", dir: "rtl", speech: "ks-IN" },
  { code: "ne", english: "Nepali", native: "नेपाली", script: "Devanagari", dir: "ltr", speech: "ne-NP" },
  { code: "sd", english: "Sindhi", native: "سنڌي", script: "Perso-Arabic", dir: "rtl", speech: "sd-IN" },
  { code: "kok", english: "Konkani", native: "कोंकणी", script: "Devanagari", dir: "ltr", speech: "kok-IN" },
  { code: "doi", english: "Dogri", native: "डोगरी", script: "Devanagari", dir: "ltr", speech: "doi-IN" },
  { code: "mni", english: "Manipuri", native: "ꯃꯤꯇꯩꯂꯣꯟ", script: "Meitei Mayek", dir: "ltr", speech: "mni-IN" },
  { code: "brx", english: "Bodo", native: "बड़ो", script: "Devanagari", dir: "ltr", speech: "brx-IN" },
  { code: "sa", english: "Sanskrit", native: "संस्कृतम्", script: "Devanagari", dir: "ltr", speech: "sa-IN" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];
export type Language = (typeof LANGUAGES)[number];

export const LANG_CODES = LANGUAGES.map((l) => l.code) as LangCode[];

export const isLangCode = (x: unknown): x is LangCode => typeof x === "string" && (LANG_CODES as string[]).includes(x);

export const languageOf = (code: LangCode): Language => LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];

/** Hindi and English are hand-written; everything else goes through the translator. */
export const isAuthored = (code: LangCode) => code === "en" || code === "hi";

/** Languages whose machine translation should be checked by a native speaker before launch. */
export const NEEDS_REVIEW: LangCode[] = ["sat", "brx", "doi", "ks", "sd", "mni", "mai", "kok", "sa"];

/** Locale for dates and numbers, falling back to Indian English when the browser lacks it. */
export function dateLocale(code: LangCode): string {
  const wanted = `${code}-IN`;
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([wanted, code]).at(0) ?? "en-IN";
  } catch {
    return "en-IN";
  }
}
