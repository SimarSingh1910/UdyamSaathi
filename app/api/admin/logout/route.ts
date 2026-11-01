import { NextResponse } from "next/server";
import { clearCookieHeader } from "@/lib/auth";

export const runtime = "nodejs";

export function POST() {
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": clearCookieHeader() } });
}
