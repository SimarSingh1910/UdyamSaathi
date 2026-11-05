import { describe, expect, it } from "vitest";
import { DELETE, PATCH } from "@/app/api/admin/leads/[id]/route";
import { POST } from "@/app/api/admin/leads/route";
import { issueToken } from "@/lib/auth";
import { NEW_LEAD_STAGE, scoredLeads } from "@/lib/leads";
import { getAddedLead } from "@/lib/store";

const cookie = () => ({ cookie: `uds_admin=${issueToken()}` });
const json = (method: string, body?: unknown, headers: Record<string, string> = cookie()) =>
  new Request("http://x/api/admin/leads", {
    method,
    headers: { ...headers, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const NEW_LEAD = {
  businessName: "Om Sai Hardware",
  businessType: "Hardware store",
  city: "Nashik",
  contactName: "Sunil Jadhav",
  phone: "+91 98220 11223",
  language: "Marathi",
  source: "Referral",
  employees: 4,
  sites: 1,
  hasGstin: true,
  currentInternet: "Home broadband",
  telecomSpend: 1500,
  note: "Wants fibre and billing before Diwali",
};

describe("adding and deleting leads", () => {
  it("adds a lead staff found, scores it with the same model and keeps the phone encrypted", async () => {
    const res = await POST(json("POST", NEW_LEAD));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect(id).toMatch(/^LA\d{6}$/);

    const lead = (await scoredLeads()).find((l) => l.id === id)!;
    expect(lead).toMatchObject({
      added: true,
      businessName: "Om Sai Hardware",
      segment: "Micro retail & services",
      stageReached: NEW_LEAD_STAGE,
      dropReason: NEW_LEAD.note,
      phoneMasked: "98XXX XX223",
      hasGstin: true,
    });
    expect(lead.probability).toBeGreaterThan(0);
    expect((await getAddedLead(id))?.phone).toBe("9822011223");

    const reveal = await PATCH(json("PATCH", { action: "reveal_phone" }), params(id));
    expect(await reveal.json()).toEqual({ phone: "9822011223" });
    const followUp = await PATCH(json("PATCH", { status: "called" }), params(id));
    expect(followUp.status).toBe(200);

    expect((await DELETE(json("DELETE"), params(id))).status).toBe(200);
    expect((await scoredLeads()).some((l) => l.id === id)).toBe(false);
    expect((await DELETE(json("DELETE"), params(id))).status).toBe(404);
  });

  it("hides a deleted dataset lead without changing the data file", async () => {
    const before = await scoredLeads();
    const target = before.find((l) => !l.added)!;
    expect((await DELETE(json("DELETE"), params(target.id))).status).toBe(200);
    const after = await scoredLeads();
    expect(after.some((l) => l.id === target.id)).toBe(false);
    expect(after.length).toBe(before.length - 1);
  });

  it("rejects incomplete leads, bad numbers, unknown ids and callers who are not signed in", async () => {
    expect((await POST(json("POST", { ...NEW_LEAD, businessName: " " }))).status).toBe(400);
    expect((await POST(json("POST", { ...NEW_LEAD, businessType: "Spaceport" }))).status).toBe(400);
    const badPhone = await POST(json("POST", { ...NEW_LEAD, phone: "12345" }));
    expect((await badPhone.json()).error).toMatch(/mobile number/);
    expect((await DELETE(json("DELETE"), params("L99999"))).status).toBe(404);
    expect((await POST(json("POST", NEW_LEAD, {}))).status).toBe(401);
    expect((await DELETE(json("DELETE", undefined, {}), params("L00001"))).status).toBe(401);
  });
});
