import type { LangCode } from "./languages";
import { llmConfig } from "./llm";

/**
 * Speech to text with Whisper (Groq or OpenAI, using the same key as the advisor).
 * The recording is sent once for transcription and not stored anywhere.
 */

/** Languages Whisper was trained on; for the others it auto-detects. */
const WHISPER_LANGS = new Set<LangCode>(["en", "hi", "bn", "mr", "te", "ta", "gu", "ur", "kn", "ml", "pa", "as", "ne", "sd", "sa"]);

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export function sttEnabled(): boolean {
  const cfg = llmConfig();
  return !!cfg && (cfg.provider === "groq" || cfg.provider === "openai");
}

export async function transcribe(audio: Blob, lang: LangCode): Promise<string | null> {
  const cfg = llmConfig();
  if (!cfg || !sttEnabled()) return null;

  const groq = cfg.provider === "groq";
  const url = groq ? "https://api.groq.com/openai/v1/audio/transcriptions" : "https://api.openai.com/v1/audio/transcriptions";
  const model = process.env.STT_MODEL || (groq ? "whisper-large-v3" : "whisper-1");

  const form = new FormData();
  form.append("file", audio, audio.type.includes("mp4") ? "speech.mp4" : audio.type.includes("ogg") ? "speech.ogg" : "speech.webm");
  form.append("model", model);
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (WHISPER_LANGS.has(lang)) form.append("language", lang);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${cfg.key}` },
        body: form,
        signal: ctrl.signal,
      });
      if (res.status === 429 && attempt < 2) {
        const after = Number(res.headers.get("retry-after"));
        await new Promise((r) => setTimeout(r, Math.min(10_000, Number.isFinite(after) && after > 0 ? after * 1000 : 3000)));
        continue;
      }
      if (!res.ok) throw new Error(`${cfg.provider} stt ${res.status} ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      return typeof data?.text === "string" ? data.text.trim() : null;
    }
    return null;
  } catch (err) {
    console.warn(`[stt] ${(err as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
