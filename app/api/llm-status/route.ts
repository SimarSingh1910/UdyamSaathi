import { NextResponse } from "next/server";
import { activeModel, complete, knownModels, lastError, llmConfig, trace } from "@/lib/llm";
import { advisorChat } from "@/lib/advisor-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/llm-status: is the advisor's LLM configured and answering? Never returns the key.
 * GET /api/llm-status?probe=chat runs one real advisor turn and reports timing and errors.
 */
export async function GET(req: Request) {
  const cfg = llmConfig();
  if (!cfg) return NextResponse.json({ enabled: false, note: "No LLM_PROVIDER/LLM_API_KEY set: advisor runs on rules." });

  const probe = new URL(req.url).searchParams.get("probe");
  const t0 = Date.now();
  let ok: boolean;
  if (probe === "chat") {
    const r = await advisorChat({
      history: [
        { role: "assistant", content: "What kind of business do you run?" },
        { role: "user", content: "I run a small pharmacy in Pune" },
      ],
      answers: {},
      lang: "en",
      pending: "businessType",
    });
    ok = r.source === "llm";
  } else {
    ok = Boolean(await complete({ system: "Reply with the single word OK.", user: "ping", timeoutMs: 15_000 }));
  }
  return NextResponse.json({
    enabled: true,
    provider: cfg.provider,
    model: activeModel(),
    probe: probe ?? "ping",
    ok,
    ms: Date.now() - t0,
    error: ok ? undefined : lastError,
    trace: trace.slice(-10),
    models: knownModels() ?? undefined,
  });
}
