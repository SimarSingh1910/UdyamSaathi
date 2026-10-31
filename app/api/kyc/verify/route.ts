import { NextResponse } from "next/server";
import { detectDocType, parseDocument, type DocType, type ParsedDoc } from "@/lib/kyc/parse";
import { verifyKyc, type KycInput } from "@/lib/kyc/verify";
import { maskGstin, maskUdyam } from "@/lib/mask";

export const runtime = "nodejs";

interface DocInput {
  /** What the owner said they uploaded. */
  slot: DocType;
  /** OCR text extracted in the browser. The image never reaches the server. */
  text: string;
}

const KEY: Record<DocType, keyof KycInput> = {
  gst_certificate: "gst",
  udyam_certificate: "udyam",
  address_proof: "bill",
  signatory_id: "id",
};

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
  const docs = Array.isArray(body.docs) ? body.docs.slice(0, 4) : [];

  const input: KycInput = {};
  const wrongDoc: { slot: DocType; detected: DocType }[] = [];

  for (const d of docs) {
    if (!d || !(d.slot in KEY) || typeof d.text !== "string") continue;
    const text = d.text.slice(0, 20_000);
    const detected = detectDocType(text);
    if (detected && detected !== d.slot) {
      wrongDoc.push({ slot: d.slot, detected });
      continue;
    }
    (input as Record<string, ParsedDoc>)[KEY[d.slot]] = parseDocument(d.slot, text);
  }

  const result = verifyKyc(input);

  // Log only masked identifiers and the outcome.
  console.info(
    `[kyc] gstin=${input.gst?.gstin ? maskGstin(input.gst.gstin) : "-"} udyam=${
      input.udyam?.udyamNumber ? maskUdyam(input.udyam.udyamNumber) : "-"
    } decision=${result.decision} fails=${result.checks.filter((c) => c.status === "fail").map((c) => c.id).join(",")}`,
  );

  return NextResponse.json(
    {
      ...result,
      wrongDoc,
      extracted: {
        gstin: input.gst?.gstin ? maskGstin(input.gst.gstin) : undefined,
        udyam: input.udyam?.udyamNumber ? maskUdyam(input.udyam.udyamNumber) : undefined,
        signatory: input.id?.name,
        billDate: input.bill?.billDate,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
