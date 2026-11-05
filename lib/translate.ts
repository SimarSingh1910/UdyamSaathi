import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inExpectedScript, languageOf, type LangCode } from "./languages";
import { complete, llmEnabled, parseJsonReply } from "./llm";
import { dataDir } from "./data-dir";

/**
 * Translation for languages without hand-written copy. English text is the key.
 * Lookup order: messages/<lang>.json (committed, reviewable) -> runtime cache in
 * the data folder -> the LLM. Anything the LLM can't do falls back to English.
 */

type Dict = Record<string, string>;

const memory = new Map<LangCode, Dict>();
const COMMITTED_DIR = () => path.join(process.cwd(), "messages");
const cacheFile = (lang: LangCode) => path.join(dataDir(), "i18n", `${lang}.json`);
const committedFile = (lang: LangCode) => path.join(COMMITTED_DIR(), `${lang}.json`);

const readJson = (file: string): Dict => {
  try {
    return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Dict) : {};
  } catch {
    return {};
  }
};

function writeJson(file: string, data: Dict) {
  mkdirSync(path.dirname(file), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(sorted, null, 1)}\n`);
  renameSync(tmp, file);
}

function dict(lang: LangCode): Dict {
  let d = memory.get(lang);
  if (!d) {
    d = { ...readJson(cacheFile(lang)), ...readJson(committedFile(lang)) };
    memory.set(lang, d);
  }
  return d;
}

const CHUNK = 40;

async function translateChunk(lang: LangCode, texts: string[]): Promise<Dict> {
  const L = languageOf(lang);
  const input = Object.fromEntries(texts.map((t, i) => [String(i + 1), t]));
  const reply = await complete({
    system:
      `You translate the interface of an Indian app that helps small shop owners buy business internet, phone and IT services. ` +
      `Translate each value into ${L.english} written in the ${L.script} script. ` +
      `Use simple, everyday words a shopkeeper would use; common English loanwords (internet, Wi-Fi, WhatsApp, CCTV, UPI) are fine. ` +
      `Keep unchanged: numbers, ₹ amounts, dates, email addresses, and the names Accel Business, UdyamSaathi, GST, GSTIN, Udyam, KYC, IVR, SIM, ` +
      `and product names such as Biz Fibre 100 or Cloud CCTV. Keep punctuation like "…", "/" and "·". ` +
      `Return a JSON object with exactly the same keys, each mapped to its translation, and nothing else.`,
    user: JSON.stringify(input),
    json: true,
    timeoutMs: 45_000,
  });
  const parsed = parseJsonReply<Record<string, unknown>>(reply);
  const out: Dict = {};
  if (!parsed) return out;
  texts.forEach((t, i) => {
    const v = parsed[String(i + 1)];
    // Models sometimes drift into another script for rarer languages; drop those
    // so the UI shows English instead of gibberish.
    if (typeof v === "string" && v.trim() && inExpectedScript(lang, v)) out[t] = v.trim();
  });
  return out;
}

/**
 * Translations for the given English texts. Missing ones are translated with the
 * LLM (in chunks) and cached. `persistToRepo` also saves them to messages/ so they
 * can be reviewed and committed; only used for the fixed UI catalogue in development.
 */
export async function translate(lang: LangCode, texts: string[], persistToRepo = false): Promise<Dict> {
  if (lang === "en") return Object.fromEntries(texts.map((t) => [t, t]));

  const d = dict(lang);
  const missing = [...new Set(texts.filter((t) => t && !d[t]))];

  if (missing.length && llmEnabled()) {
    const chunks: string[][] = [];
    for (let i = 0; i < missing.length; i += CHUNK) chunks.push(missing.slice(i, i + CHUNK));
    // A few chunks at a time keeps within free-tier rate limits.
    for (let i = 0; i < chunks.length; i += 3) {
      const results = await Promise.all(chunks.slice(i, i + 3).map((c) => translateChunk(lang, c)));
      for (const r of results) Object.assign(d, r);
    }
    const cache = { ...readJson(cacheFile(lang)) };
    for (const t of missing) if (d[t]) cache[t] = d[t];
    writeJson(cacheFile(lang), cache);

    if (persistToRepo && process.env.NODE_ENV === "development") {
      const committed = readJson(committedFile(lang));
      for (const t of texts) if (d[t]) committed[t] = d[t];
      writeJson(committedFile(lang), committed);
    }
  }

  return Object.fromEntries(texts.filter((t) => d[t]).map((t) => [t, d[t]]));
}
