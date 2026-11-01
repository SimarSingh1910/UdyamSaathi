"use client";

import { useEffect, useState } from "react";
import { LANGUAGES } from "@/lib/languages";
import { useI18n } from "./I18nProvider";

/** Grid of all 23 languages, each shown in its own script. */
export function LanguageGrid({ onPick }: { onPick?: () => void }) {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-grid">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          lang={l.code}
          dir={l.dir}
          className={`lang-tile${l.code === lang ? " on" : ""}`}
          onClick={() => {
            setLang(l.code);
            onPick?.();
          }}
        >
          <span className="native">{l.native}</span>
          <span className="english">{l.english}</span>
        </button>
      ))}
    </div>
  );
}

/** Dispatch on window to open the language sheet from elsewhere (the help assistant). */
export const OPEN_LANGUAGE_EVENT = "udyamsaathi:open-language";

/** Compact button for headers; opens the language grid in a sheet. */
export default function LanguagePicker() {
  const { language, t, loading } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_LANGUAGE_EVENT, show);
    return () => window.removeEventListener(OPEN_LANGUAGE_EVENT, show);
  }, []);

  return (
    <>
      <button type="button" className="chip lang-button" onClick={() => setOpen(true)} aria-label={t("language")}>
        🌐 <span lang={language.code}>{language.native}</span>
        {loading && <span className="muted small"> …</span>}
      </button>
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t("chooseLanguage")}>
            <div className="row sheet-head">
              <b>{t("chooseLanguage")}</b>
              <button type="button" className="chip" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <LanguageGrid onPick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
