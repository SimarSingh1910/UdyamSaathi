// Translate the fixed UI into every language and save messages/<lang>.json.
// Run with `npm run dev` already running (and an LLM key in .env.local):
//   node scripts/warm-translations.mjs [http://localhost:3000]
const base = process.argv[2] ?? "http://localhost:3000";
const langs = ["bn", "mr", "te", "ta", "gu", "ur", "kn", "or", "ml", "pa", "as", "mai", "sat", "ks", "ne", "sd", "kok", "doi", "mni", "brx", "sa"];

for (const lang of langs) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${base}/api/i18n/${lang}`);
    const data = await res.json();
    const n = Object.keys(data.translations ?? {}).length;
    console.log(`${lang.padEnd(4)} ${data.complete ? "complete" : "partial "} ${String(n).padStart(4)} strings  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.log(`${lang.padEnd(4)} failed: ${e.message}`);
  }
}
