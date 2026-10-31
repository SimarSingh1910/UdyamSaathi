import { NextResponse } from "next/server";
import { maskGstin } from "@/lib/mask";
import { lookupGstin } from "@/lib/registry";

export const runtime = "nodejs";

const HTTP_STATUS = { found: 200, invalid: 422, not_found: 404 } as const;

/** GET /api/lookup/gstin/:gstin. Mock of a GSTN taxpayer lookup. */
export async function GET(_req: Request, { params }: { params: Promise<{ gstin: string }> }) {
  const { gstin } = await params;
  const result = lookupGstin(decodeURIComponent(gstin));

  // Never log the full identifier.
  console.info(
    `[lookup] gstin=${maskGstin(result.validation.normalized)} outcome=${result.outcome}` +
      (result.record ? ` status=${result.record.status}` : ""),
  );

  return NextResponse.json(result, {
    status: HTTP_STATUS[result.outcome],
    headers: { "Cache-Control": "no-store" },
  });
}
