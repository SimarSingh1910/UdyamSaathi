import { NextResponse } from "next/server";
import { checkPasscode, cookieHeader, issueToken } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /api/admin/login { passcode } -> sets the back-office session cookie. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!checkPasscode(body?.passcode)) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": cookieHeader(issueToken()) } });
}
