import { NextResponse } from "next/server";
import { verifyMethods } from "@/lib/verify/phone";

export const runtime = "nodejs";

/** GET /api/verify. Which ways of verifying a phone are available ("live", "demo" or "off"). */
export async function GET() {
  return NextResponse.json({ methods: verifyMethods() });
}
