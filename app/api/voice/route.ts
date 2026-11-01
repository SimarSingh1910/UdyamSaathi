import { NextResponse } from "next/server";
import { isLangCode } from "@/lib/languages";
import { MAX_AUDIO_BYTES, sttEnabled, transcribe } from "@/lib/stt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/voice: can the server transcribe? If not, the browser's own speech recognition is used. */
export function GET() {
  return NextResponse.json({ server: sttEnabled() });
}

/**
 * POST /api/voice (multipart: audio, lang) -> { text }.
 * The recording is passed to Whisper once and discarded; nothing is stored or logged.
 */
export async function POST(req: Request) {
  if (!sttEnabled()) return NextResponse.json({ error: "Voice input is not configured" }, { status: 503 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const lang = form?.get("lang");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "audio is required" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Recording is too long" }, { status: 413 });

  const text = await transcribe(audio, isLangCode(lang) ? lang : "en");
  if (text === null) return NextResponse.json({ error: "Could not transcribe" }, { status: 502 });
  return NextResponse.json({ text });
}
