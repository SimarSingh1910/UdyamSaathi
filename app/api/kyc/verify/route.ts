import { NextResponse } from "next/server";
import { checkKycDocs } from "@/lib/kyc/check";
import type { DocType } from "@/lib/kyc/parse";

export const runtime = "nodejs";

interface DocInput {
  /** What the owner said they uploaded. */
  slot: DocType;
  /** OCR text extracted in the browser. The image never reaches the server. */
  text: string;
}

/**
 * POST /api/kyc/verify
 * Body: { consent: true, docs: [{ slot, text }] }
 * Nothing is stored: the text is parsed, checked and discarded with the request.
 */
export async function POST(req: Request) {
  let body: { consent?: boolean; docs?: DocInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  if (body.consent !== true) {
    return NextResponse.json({ error: "Consent is required before KYC documents are processed." }, { status: 403 });
  }
  const docs = Array.isArray(body.docs) ? body.docs : [];
  return NextResponse.json(checkKycDocs(docs), { headers: { "Cache-Control": "no-store" } });
}
