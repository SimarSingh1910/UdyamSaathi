"use client";

import { useEffect, useState } from "react";
import { languageOf } from "@/lib/languages";
import { useI18n } from "./I18nProvider";

/**
 * Reads a message aloud with the device's own voices (Speech Synthesis API). Edge has
 * natural voices for most Indian languages; Chrome has English and Hindi everywhere,
 * and more on Android. When the device has no voice for the language the button is
 * shown disabled with a note, rather than reading the text in a wrong accent.
 */

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

let voicesCache: SpeechSynthesisVoice[] = [];
function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(voicesCache);
  useEffect(() => {
    if (!supported()) return;
    const load = () => {
      voicesCache = window.speechSynthesis.getVoices();
      setVoices(voicesCache);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}

/** Best voice for a BCP-47 tag like "hi-IN": exact match, then same language; natural voices first. */
export function pickVoice(voices: SpeechSynthesisVoice[], tag: string): SpeechSynthesisVoice | null {
  const norm = (l: string) => l.toLowerCase().replace("_", "-");
  const want = norm(tag);
  const base = want.split("-")[0];
  const exact = voices.filter((v) => norm(v.lang) === want);
  const pool = exact.length ? exact : voices.filter((v) => norm(v.lang).split("-")[0] === base);
  return pool.find((v) => /natural|online/i.test(v.name)) ?? pool.find((v) => /google/i.test(v.name)) ?? pool[0] ?? null;
}

/** Only one message speaks at a time across the app. */
let current = 0;
let counter = 0;
const listeners = new Set<() => void>();
const setCurrent = (id: number) => {
  current = id;
  listeners.forEach((f) => f());
};

function speak(text: string, voice: SpeechSynthesisVoice, onEnd: () => void) {
  const synth = window.speechSynthesis;
  synth.cancel();
  // Chrome stops long utterances after ~15 s, so queue sentence by sentence.
  const parts = text
    .replace(/[*_#`>]/g, "")
    .split(/(?<=[.!?।॥؟])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.95;
    if (i === parts.length - 1) {
      u.onend = onEnd;
      u.onerror = onEnd;
    }
    synth.speak(u);
  });
}

export default function SpeakButton({ text }: { text: string }) {
  const { lang, t } = useI18n();
  const voices = useVoices();
  const [id] = useState(() => ++counter);
  const [speaking, setSpeaking] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const sync = () => setSpeaking(current === id);
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
      if (current === id && supported()) {
        window.speechSynthesis.cancel();
        current = 0;
      }
    };
  }, [id]);

  // Stop reading when the language changes; the text is about to change too.
  useEffect(() => {
    if (current === id && supported()) {
      window.speechSynthesis.cancel();
      setCurrent(0);
    }
  }, [lang, id]);

  if (!mounted || !supported() || !text.trim()) return null;
  const voice = pickVoice(voices, languageOf(lang).speech);
  const label = !voice ? t("noVoice") : speaking ? t("stopSpeaking") : t("listen");

  return (
    <button
      type="button"
      className={`speak${speaking ? " speak-on" : ""}`}
      disabled={!voice}
      title={label}
      aria-label={label}
      aria-pressed={speaking}
      onClick={() => {
        if (!voice) return;
        if (speaking) {
          window.speechSynthesis.cancel();
          setCurrent(0);
          return;
        }
        setCurrent(id);
        speak(text, voice, () => {
          if (current === id) setCurrent(0);
        });
      }}
    >
      {speaking ? (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      )}
    </button>
  );
}
