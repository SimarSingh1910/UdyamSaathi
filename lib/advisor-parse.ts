import { BUSINESS_TYPES, CITY_TIERS, type AdvisorAnswers, type CurrentInternet, type Need } from "./advisor";
import { CITY_HI } from "./i18n";
import { complete, parseJsonReply } from "./llm";

export type PartialAnswers = Partial<AdvisorAnswers>;

const ALL_TYPES = Object.values(BUSINESS_TYPES).flat();
const NEEDS: Need[] = [
  "billing", "whatsapp", "cctv", "email", "security", "backup_internet",
  "phone_line", "guest_wifi", "website", "cloud_backup", "machines", "fleet",
];
const INTERNET: CurrentInternet[] = ["Mobile hotspot", "Home broadband", "Business broadband", "Leased line", "Mixed per site", "None"];

/** Hindi / Hinglish words owners commonly use, mapped to business types. */
const TYPE_KEYWORDS: [RegExp, string][] = [
  [/kirana|किराना|grocery|general store/i, "Kirana store"],
  [/pharmacy chain|medical chain/i, "Pharmacy chain"],
  [/pharmacy|chemist|medical store|दवा|मेडिकल/i, "Pharmacy"],
  [/salon|parlou?r|सैलून|पार्लर/i, "Salon"],
  [/bakery chain/i, "Bakery chain"],
  [/bakery|बेकरी/i, "Bakery"],
  [/sweet|mithai|मिठाई/i, "Sweet shop"],
  [/boutique|बुटीक/i, "Boutique"],
  [/hardware/i, "Hardware store"],
  [/mobile repair|phone repair/i, "Mobile repair shop"],
  [/optic|chashm|चश्म/i, "Optician"],
  [/stationery|स्टेशनरी/i, "Stationery shop"],
  [/dental|dentist|डेंटल/i, "Dental clinic"],
  [/physio/i, "Physiotherapy clinic"],
  [/diagnostic|pathology|lab\b|लैब/i, "Diagnostic lab"],
  [/\bca\b|chartered accountant|ca firm/i, "CA firm"],
  [/law|lawyer|advocate|वकील/i, "Law office"],
  [/coaching|tuition|कोचिंग/i, "Coaching centre"],
  [/architect/i, "Architecture studio"],
  [/insurance|बीमा/i, "Insurance agency"],
  [/real estate|property|प्रॉपर्टी/i, "Real estate agency"],
  [/travel|tour|ट्रैवल/i, "Travel agency"],
  [/restaurant|dhaba|cafe|रेस्टोरेंट/i, "Restaurant chain"],
  [/apparel|garment|clothing|कपड़/i, "Apparel retail chain"],
  [/electronics/i, "Electronics retail chain"],
  [/gym|fitness/i, "Gym chain"],
  [/pre-?school|play ?school/i, "Pre-school chain"],
  [/hotel|guest ?house|होटल/i, "Budget hotel group"],
  [/auto.?parts/i, "Auto-parts unit"],
  [/textile|weaving|कपड़ा मिल/i, "Textile unit"],
  [/food processing/i, "Food processing unit"],
  [/packaging/i, "Packaging unit"],
  [/plastic|moulding/i, "Plastic moulding unit"],
  [/printing|press/i, "Printing press"],
  [/furniture|carpent|woodcraft|फ़र्नीचर|फर्नीचर/i, "Furniture workshop"],
];

const NEED_KEYWORDS: [RegExp, Need][] = [
  [/billing|pos|upi|payment|बिलिंग|पेमेंट/i, "billing"],
  [/whatsapp|व्हाट्सएप/i, "whatsapp"],
  [/cctv|camera|कैमरा|सीसीटीवी/i, "cctv"],
  [/email|e-mail|ईमेल/i, "email"],
  [/secur|virus|hack|सुरक्षा/i, "security"],
  [/backup internet|failover|internet (goes|is) down|नेट चला जाता/i, "backup_internet"],
  [/ivr|phone line|calls?\b|toll.?free/i, "phone_line"],
  [/wi-?fi|wifi|वाईफ़ाई|वाईफाई/i, "guest_wifi"],
  [/website|वेबसाइट|google/i, "website"],
  [/backup|बैकअप/i, "cloud_backup"],
  [/machine|मशीन/i, "machines"],
  [/vehicle|delivery|fleet|truck|गाड़ी|गाड़ियों/i, "fleet"],
];

const HINDI_DIGITS: Record<string, string> = { "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9" };
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, char: 4, paanch: 5, एक: 1, दो: 2, तीन: 3, चार: 4, पांच: 5, पाँच: 5,
};

function numberNear(text: string, words: RegExp): number | undefined {
  const re = new RegExp(`(\\d+|${Object.keys(WORD_NUMBERS).join("|")})\\s*(?:\\+\\s*)?(?:[^\\s\\d,.]+\\s+){0,2}?(?:${words.source})`, "i");
  const m = text.match(re);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : WORD_NUMBERS[m[1].toLowerCase()];
}

const YES = /^(yes|yeah|yep|haan|ha|han|ji|ji haan|hai|हाँ|हां|हा|जी|जी हाँ|है|ho|aahe|ಹೌದು|ஆம்|అవును|হ্যাঁ|હા|ਹਾਂ|അതെ|ହଁ|ہاں|ji han)(?=[\s,.!?]|$)/iu;
const NO = /^(no|nope|nahi|nahin|na|नहीं|नही|ना|nathi|ಇಲ್ಲ|இல்லை|లేదు|না|ના|ਨਹੀਂ|ഇല്ല|ନା|نہیں)(?=[\s,.!?]|$)/iu;

/** Questions the advisor asks; a short spoken answer refers to the one on screen. */
export type QuestionKey = "businessType" | "city" | "employees" | "sites" | "currentInternet" | "needs" | "hasGstin";
const QUESTION_TEXT: Record<QuestionKey, string> = {
  businessType: "What kind of business do you run?",
  city: "Which city are you in?",
  employees: "How many people work with you?",
  sites: "How many shops, branches or locations?",
  currentInternet: "What internet do you use today?",
  needs: "What would help your business?",
  hasGstin: "Is your business GST registered?",
};
const isQuestion = (x: unknown): x is QuestionKey => typeof x === "string" && x in QUESTION_TEXT;

/** Keyword parser: works offline and in Hindi/Hinglish for common phrasings. */
export function parseByKeywords(message: string, context?: string): PartialAnswers {
  const text = message.replace(/[०-९]/g, (d) => HINDI_DIGITS[d]);
  const out: PartialAnswers = {};

  const type = TYPE_KEYWORDS.find(([re]) => re.test(text));
  if (type) out.businessType = type[1];

  const city = Object.keys(CITY_TIERS).find((c) => new RegExp(`\\b${c}\\b`, "i").test(text) || (CITY_HI[c] && text.includes(CITY_HI[c])))
    ?? (/bangalore/i.test(text) ? "Bengaluru" : /bombay/i.test(text) ? "Mumbai" : /दिल्ली/.test(text) ? "Delhi" : undefined);
  if (city) out.city = city;

  const staff = numberNear(text, /people|staff|employees?|workers?|log|लोग|कर्मचारी|स्टाफ़?/);
  if (staff) out.employees = staff;
  const sites = numberNear(text, /shops?|stores?|branch(?:es)?|outlets?|locations?|sites?|दुकानें|दुकान|ब्रांच/);
  if (sites) out.sites = sites;

  if (/hotspot|phone.?(?:ka|se)? internet|मोबाइल.*इंटरनेट|हॉटस्पॉट/i.test(text)) out.currentInternet = "Mobile hotspot";
  else if (/home broadband|home wifi|घर का/i.test(text)) out.currentInternet = "Home broadband";
  else if (/leased line/i.test(text)) out.currentInternet = "Leased line";
  else if (/business broadband|(use|have|got|hai|है).{0,15}(broadband|fibre|fiber)|(broadband|fibre|fiber).{0,10}(hai|है|connection)/i.test(text))
    out.currentInternet = "Business broadband";
  else if (/no internet|इंटरनेट नहीं/i.test(text)) out.currentInternet = "None";

  // Only a clear statement counts: "kya GST ke bina milega?" is a question, not an answer.
  if (/\bno gst|gst nahi hai|gst नहीं है|not gst registered|not registered (for|under) gst/i.test(text)) out.hasGstin = false;
  else if (/(have|got|has|registered|hamare paas|मेरे पास|हमारे पास).{0,12}(gst|जीएसटी)|(gst|जीएसटी).{0,12}(registered|number|नंबर|रजिस्टर्ड|hai|है)(?!\s*\?)/i.test(text) && !/\?\s*$/.test(text.trim()))
    out.hasGstin = true;

  const needs = NEED_KEYWORDS.filter(([re]) => re.test(text)).map(([, n]) => n);
  if (needs.length) out.needs = [...new Set(needs)];

  // Short answers to the question on screen: "haan", "5", "do".
  const trimmed = text.trim().replace(/[.!?।]+$/, "");
  if (context === "hasGstin" && out.hasGstin === undefined) {
    if (YES.test(trimmed)) out.hasGstin = true;
    else if (NO.test(trimmed)) out.hasGstin = false;
  }
  if ((context === "employees" || context === "sites") && out[context] === undefined) {
    const m = trimmed.match(/^(\d+)/) ?? trimmed.match(new RegExp(`^(${Object.keys(WORD_NUMBERS).join("|")})\\b`, "i"));
    if (m) {
      const n = Number(m[1]) || WORD_NUMBERS[m[1].toLowerCase()];
      if (n > 0) out[context] = n;
    }
  }

  return out;
}

const SYSTEM = `You extract facts about an Indian small business from the owner's message (English, Hindi or Hinglish).
Return JSON with only the keys you are confident about:
- businessType: one of ${JSON.stringify(ALL_TYPES)}
- city: one of ${JSON.stringify(Object.keys(CITY_TIERS))} or another city name as written
- employees: integer, sites: integer (number of shops/branches/locations)
- currentInternet: one of ${JSON.stringify(INTERNET)}
- needs: array from ${JSON.stringify(NEEDS)}
- hasGstin: boolean
Never guess. Omit a key if the message does not say it.`;

/** Use the LLM when configured, otherwise keywords. Keyword hits fill any gaps. */
export async function parseAnswers(
  message: string,
  context?: string,
): Promise<{ answers: PartialAnswers; source: "llm" | "rules" }> {
  const rules = parseByKeywords(message, context);
  const system = isQuestion(context)
    ? `${SYSTEM}\nThe owner is answering the question "${QUESTION_TEXT[context]}" (key: ${context}). ` +
      `A short reply such as "yes", "haan", a number or a city name answers that question.`
    : SYSTEM;
  const reply = parseJsonReply<PartialAnswers>(
    await complete({ system, user: message.slice(0, 2000), json: true, timeoutMs: 10_000 }),
  );
  if (!reply) return { answers: rules, source: "rules" };
  return { answers: { ...rules, ...cleanAnswers(reply) }, source: "llm" };
}

/** Keep only well-formed values from a model's guess at the answers. */
export function cleanAnswers(reply: Record<string, unknown>): PartialAnswers {
  const clean: PartialAnswers = {};
  const r = reply as PartialAnswers;
  if (r.businessType && ALL_TYPES.includes(r.businessType)) clean.businessType = r.businessType;
  if (typeof r.city === "string" && r.city.trim()) clean.city = r.city.trim().slice(0, 60);
  if (Number.isFinite(Number(r.employees)) && Number(r.employees) > 0) clean.employees = Math.min(500, Math.round(Number(r.employees)));
  if (Number.isFinite(Number(r.sites)) && Number(r.sites) > 0) clean.sites = Math.min(50, Math.round(Number(r.sites)));
  if (r.currentInternet && INTERNET.includes(r.currentInternet)) clean.currentInternet = r.currentInternet;
  if (Array.isArray(r.needs)) {
    const needs = r.needs.filter((n): n is Need => NEEDS.includes(n));
    if (needs.length) clean.needs = needs;
  }
  if (typeof r.hasGstin === "boolean") clean.hasGstin = r.hasGstin;
  return clean;
}

export { ALL_TYPES, INTERNET, NEEDS, QUESTION_TEXT };
