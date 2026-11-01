"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { STRINGS, type StringKey, type Text } from "@/lib/i18n";
import { NEEDS_REVIEW, isAuthored, isLangCode, languageOf, type LangCode, type Language } from "@/lib/languages";

interface I18n {
  lang: LangCode;
  language: Language;
  /** True once the user has picked a language on this device. */
  chosen: boolean;
  setLang: (l: LangCode) => void;
  /** Fixed UI copy by key. */
  t: (key: StringKey) => string;
  /** Any copy: a hand-written {en, hi} pair or an English string. Translated on demand. */
  tt: (text: Text | string) => string;
  /** The UI catalogue for this language is still loading. */
  loading: boolean;
  machineTranslated: boolean;
}

const Ctx = createContext<I18n | null>(null);
const STORAGE_KEY = "udyamsaathi.lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("en");
  const [chosen, setChosen] = useState(false);
  const [dict, setDict] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const pending = useRef(new Set<string>());
  const requested = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const langRef = useRef(lang);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isLangCode(saved)) {
        setLangState(saved);
        setChosen(true);
      }
    } catch {
      /* storage unavailable: stay on English until the user picks */
    }
  }, []);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    setChosen(true);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  // Load the fixed UI for the language, and set the page's language and direction.
  useEffect(() => {
    langRef.current = lang;
    const L = languageOf(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = L.dir;
    setDict({});
    requested.current = new Set();
    pending.current = new Set();
    if (isAuthored(lang)) return;

    let alive = true;
    setLoading(true);
    fetch(`/api/i18n/${lang}`)
      .then((r) => (r.ok ? r.json() : { translations: {} }))
      .then((d) => alive && setDict((cur) => ({ ...d.translations, ...cur })))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [lang]);

  const flush = useCallback(() => {
    timer.current = null;
    const texts = [...pending.current].slice(0, 60);
    texts.forEach((t) => pending.current.delete(t));
    if (!texts.length) return;
    const forLang = langRef.current;
    fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: forLang, texts }),
    })
      .then((r) => (r.ok ? r.json() : { translations: {} }))
      .then((d) => {
        if (langRef.current === forLang) setDict((cur) => ({ ...cur, ...d.translations }));
      })
      .catch(() => {})
      .finally(() => {
        if (pending.current.size) timer.current = setTimeout(flush, 50);
      });
  }, []);

  const tt = useCallback(
    (text: Text | string): string => {
      const en = typeof text === "string" ? text : text.en;
      if (lang === "en" || !en) return en;
      if (lang === "hi" && typeof text !== "string") return text.hi;
      const hit = dict[en];
      if (hit) return hit;
      // Queue it for translation; show English meanwhile.
      if (!loading && !requested.current.has(en)) {
        requested.current.add(en);
        pending.current.add(en);
        if (!timer.current) timer.current = setTimeout(flush, 120);
      }
      return en;
    },
    [lang, dict, loading, flush],
  );

  const t = useCallback((key: StringKey) => tt(STRINGS[key]), [tt]);

  return (
    <Ctx.Provider
      value={{
        lang,
        language: languageOf(lang),
        chosen,
        setLang,
        t,
        tt,
        loading,
        machineTranslated: !isAuthored(lang),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useI18n(): I18n {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export const needsReview = (l: LangCode) => NEEDS_REVIEW.includes(l);
