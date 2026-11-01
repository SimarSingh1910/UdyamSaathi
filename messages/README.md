# Translations

One file per language, mapping the English UI text to its translation. Hindi and English are written by hand in `lib/i18n.ts`; these files are machine-translated with the LLM the first time a language is opened in development (`npm run dev`), then committed so the app does not depend on the LLM at runtime.

To fill or refresh them: start `npm run dev` with an LLM key in `.env.local`, then run `node scripts/warm-translations.mjs`.

Languages marked for review in `lib/languages.ts` (`NEEDS_REVIEW`) should be checked by a native speaker before launch.
