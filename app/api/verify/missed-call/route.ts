import { NextResponse, after } from "next/server";
import { safeEqual } from "@/lib/security/hash";
import { recordMissedCall, simulateMissedCall } from "@/lib/verify/phone";
import { onPhoneVerified } from "@/lib/whatsapp/bot";
import type { PhoneVerification } from "@/lib/store";

export const runtime = "nodejs";

/** Field names the common Indian missed-call providers use for the caller. */
const CALLER_FIELDS = ["From", "from", "CallFrom", "caller", "Caller", "msisdn", "mobile", "caller_id"];

function callerFrom(params: URLSearchParams | Record<string, unknown>): string {
  for (const f of CALLER_FIELDS) {
    const v = params instanceof URLSearchParams ? params.get(f) : params[f];
    if (v) return String(v);
  }
  return "";
}

function secretOk(req: Request, url: URL): boolean {
  const want = process.env.MISSED_CALL_WEBHOOK_SECRET ?? "";
  const got = url.searchParams.get("secret") ?? req.headers.get("x-webhook-secret") ?? "";
  return Boolean(want) && safeEqual(got, want);
}

function resume(verified: PhoneVerification[]) {
  // Chats waiting on this call carry on (place the order) after we answer the provider.
  const sessions = verified.map((v) => v.waSession).filter((s): s is string => Boolean(s));
  if (sessions.length) after(() => Promise.all(sessions.map(onPhoneVerified)));
}

/**
 * GET or POST /api/verify/missed-call?secret=…
 * Called by the telephony provider when someone rings the missed-call number.
 * Point the provider (e.g. an Exotel Passthru applet) here with the shared secret.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!secretOk(req, url)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const verified = await recordMissedCall(callerFrom(url.searchParams));
  resume(verified);
  return NextResponse.json({ ok: true, verified: verified.length });
}

/**
 * POST with the provider's form or JSON body, or { simulate: id } in demo mode to
 * pretend the call for that check came in.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const type = req.headers.get("content-type") ?? "";
  const body: Record<string, unknown> = type.includes("json")
    ? ((await req.json().catch(() => ({}))) as Record<string, unknown>)
    : Object.fromEntries((await req.formData().catch(() => new FormData())).entries());

  if (typeof body.simulate === "string") {
    const v = await simulateMissedCall(body.simulate);
    if (!v) return NextResponse.json({ error: "not available" }, { status: 404 });
    resume([v]);
    return NextResponse.json({ ok: true, verified: 1 });
  }

  if (!secretOk(req, url)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const verified = await recordMissedCall(callerFrom(body));
  resume(verified);
  return NextResponse.json({ ok: true, verified: verified.length });
}
