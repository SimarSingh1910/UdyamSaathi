import { NextResponse } from "next/server";
import { activeModel, complete, lastError, llmConfig } from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/llm-status: is the advisor's LLM configured and answering? Never returns the key. */
export async function GET() {
  const cfg = llmConfig();
  if (!cfg) return NextResponse.json({ enabled: false, note: "No LLM_PROVIDER/LLM_API_KEY set: advisor runs on rules." });

  const reply = await complete({ system: "Reply with the single word OK.", user: "ping", timeoutMs: 15_000 });
  return NextResponse.json({
    enabled: true,
    provider: cfg.provider,
    model: activeModel(),
    ok: Boolean(reply),
    error: reply ? undefined : lastError,
  });
}
