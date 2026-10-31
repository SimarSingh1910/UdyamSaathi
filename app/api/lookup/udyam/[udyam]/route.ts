import { NextResponse } from "next/server";
import { maskUdyam } from "@/lib/mask";
import { lookupUdyam } from "@/lib/registry";

export const runtime = "nodejs";

const HTTP_STATUS = { found: 200, invalid: 422, not_found: 404 } as const;

/** GET /api/lookup/udyam/:udyam. Mock of the Udyam registration lookup. */
export async function GET(_req: Request, { params }: { params: Promise<{ udyam: string }> }) {
  const { udyam } = await params;
  const result = lookupUdyam(decodeURIComponent(udyam));

  // Never log the full identifier.
  console.info(`[lookup] udyam=${maskUdyam(result.validation.normalized)} outcome=${result.outcome}`);

  return NextResponse.json(result, {
    status: HTTP_STATUS[result.outcome],
    headers: { "Cache-Control": "no-store" },
  });
}
