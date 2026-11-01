"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";

/**
 * Tap to speak, tap again to stop. Uses server-side Whisper when available (works
 * in any modern browser and most Indian languages); otherwise the browser's own
 * speech recognition (Chrome/Edge). Hidden when neither is possible.
 */

type Mode = "server" | "browser" | "none";
type State = "idle" | "recording" | "transcribing" | "error" | "denied";

const MAX_SECONDS = 30;

let modePromise: Promise<Mode> | null = null;
function detectMode(): Promise<Mode> {
  if (!modePromise) {
    const hasRecorder = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
    const hasBrowserStt =
      typeof window !== "undefined" &&
      !!((window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition);
    modePromise = fetch("/api/voice")
      .then((r) => r.json())
      .then((d) => (d.server && hasRecorder ? "server" : hasBrowserStt ? "browser" : "none") as Mode)
      .catch(() => (hasBrowserStt ? "browser" : "none") as Mode);
  }
  return modePromise;
}

function pickMime(): string | undefined {
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return undefined;
}

// Minimal typing for the Web Speech API (not in TypeScript's DOM lib).
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function VoiceButton({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const { t, lang, language } = useI18n();
  const [mode, setMode] = useState<Mode | null>(null);
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);

  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    detectMode().then(setMode);
    return () => {
      if (tick.current) clearInterval(tick.current);
      recorder.current?.stream.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  function startTimer(stop: () => void) {
    setSeconds(0);
    tick.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  }
  const stopTimer = () => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
  };

  async function startServer() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, noiseSuppression: true, echoCancellation: true } });
    } catch {
      setState("denied");
      return;
    }
    const mimeType = pickMime();
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = async () => {
      stopTimer();
      stream.getTracks().forEach((tr) => tr.stop());
      const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
      if (blob.size < 1500) {
        setState("error");
        return;
      }
      setState("transcribing");
      try {
        const form = new FormData();
        form.append("audio", blob);
        form.append("lang", lang);
        const res = await fetch("/api/voice", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok || !data.text?.trim()) throw new Error();
        setState("idle");
        onText(data.text.trim());
      } catch {
        setState("error");
      }
    };
    recorder.current = rec;
    rec.start();
    setState("recording");
    startTimer(() => rec.state === "recording" && rec.stop());
  }

  function startBrowser() {
    const w = window as unknown as Record<string, new () => Recognition>;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    const r = new Ctor();
    r.lang = language.speech;
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim();
      setState("idle");
      if (text) onText(text);
    };
    r.onerror = (e) => setState(e.error === "not-allowed" ? "denied" : "error");
    r.onend = () => {
      stopTimer();
      setState((s) => (s === "recording" ? "idle" : s));
    };
    recognition.current = r;
    r.start();
    setState("recording");
    startTimer(() => r.stop());
  }

  function toggle() {
    if (state === "recording") {
      if (mode === "server") recorder.current?.stop();
      else recognition.current?.stop();
      return;
    }
    if (state === "transcribing") return;
    if (mode === "server") startServer();
    else if (mode === "browser") startBrowser();
  }

  if (!mode || mode === "none") return null;

  const label =
    state === "recording"
      ? `${t("micListening")} ${seconds}s`
      : state === "transcribing"
        ? t("micTranscribing")
        : t("micStart");

  return (
    <div className="voice">
      <button
        type="button"
        className={`mic${state === "recording" ? " mic-on" : ""}`}
        onClick={toggle}
        disabled={disabled || state === "transcribing"}
        aria-label={label}
        aria-pressed={state === "recording"}
      >
        🎤 <span>{label}</span>
      </button>
      {state === "error" && <p className="small fail">{t("micError")}</p>}
      {state === "denied" && <p className="small fail">{t("micDenied")}</p>}
    </div>
  );
}
