import { createHmac } from "node:crypto";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { handleIncoming, onPhoneVerified, sessionKey, type Incoming } from "@/lib/whatsapp/bot";
import { drainOutbox, type OutMessage } from "@/lib/whatsapp/client";
import { parseWebhook, validSignature } from "@/lib/whatsapp/webhook";
import { getOrder, getWaSession } from "@/lib/store";
import {
  checkCode,
  checkPhoneToken,
  issuePhoneToken,
  recordMissedCall,
  startVerification,
  verificationIsFor,
  verifyMethods,
} from "@/lib/verify/phone";

// No WhatsApp credentials, no LLM: the bot runs in demo mode on rules, which is
// exactly what the simulator at /whatsapp uses.

let n = 0;
async function send(from: string, m: Partial<Incoming>): Promise<OutMessage[]> {
  await handleIncoming({ id: `test-${n++}`, from, ...m });
  return drainOutbox(from);
}
const tap = (from: string, replyId: string) => send(from, { replyId });
const type = (from: string, text: string) => send(from, { text });
const textOf = (msgs: OutMessage[]) => msgs.map((m) => m.text).join("\n");
const optionIds = (msgs: OutMessage[]) =>
  msgs.flatMap((m) => (m.type === "buttons" ? m.buttons.map((b) => b.id) : m.type === "list" ? m.rows.map((r) => r.id) : []));

/** Advisor, bundle and KYC (sample applicant K03, which passes), up to "which number do we call?". */
async function throughKyc(from: string) {
  expect(optionIds(await type(from, "hi"))).toEqual(["lang:en", "lang:hi", "lang:other"]);
  expect(textOf(await tap(from, "lang:en"))).toContain("What kind of business");
  expect(textOf(await type(from, "I have a kirana store in Pune with 3 people"))).toContain("How many shops");
  expect(optionIds(await type(from, "1"))).toContain("ans:currentInternet:0");
  expect(optionIds(await tap(from, "ans:currentInternet:0"))).toEqual(["ans:needs:suggested"]);
  expect(optionIds(await tap(from, "ans:needs:suggested"))).toEqual(["ans:hasGstin:yes", "ans:hasGstin:no"]);

  const bundle = await tap(from, "ans:hasGstin:yes");
  expect(textOf(bundle)).toContain("Monthly total");
  expect(optionIds(bundle)).toEqual(["bundle:continue", "bundle:edit", "start_over"]);

  // Switching a product off and on again goes through the edit list.
  const edit = await tap(from, "bundle:edit");
  const toggle = optionIds(edit).find((id) => id.startsWith("toggle:"))!;
  expect(optionIds(await tap(from, toggle))).toContain("edit:done");
  await tap(from, toggle);
  await tap(from, "edit:done");

  expect(optionIds(await tap(from, "bundle:continue"))).toEqual(["consent:yes", "consent:no"]);
  expect(textOf(await tap(from, "consent:yes"))).toContain("4 documents");

  const kyc = await type(from, "SAMPLE K03");
  expect(textOf(kyc)).toContain("All documents verified");
  expect(optionIds(kyc)).toEqual(["name:use"]);
  expect(optionIds(await tap(from, "name:use"))).toEqual(["phone:own", "phone:other"]);
}

describe("WhatsApp journey", () => {
  it("goes from hello to a placed order, verifying another number with a WhatsApp code", async () => {
    const from = "919876543210";
    await throughKyc(from);

    expect(textOf(await tap(from, "phone:other"))).toContain("10-digit");
    expect(textOf(await type(from, "12345"))).toContain("valid 10-digit");
    // SMS, voice call, WhatsApp and "this number": more than 3, so a list.
    expect(optionIds(await type(from, "+91 98111 22233"))).toEqual(["verify:sms", "verify:voice", "verify:whatsapp", "phone:own"]);

    const sent = textOf(await tap(from, "verify:sms"));
    expect(sent).toContain("by SMS");
    const code = sent.match(/code is (\d{6})/)![1];
    const wrong = code === "000000" ? "111111" : "000000";
    expect(textOf(await type(from, wrong))).toContain("doesn't match");

    const done = await type(from, code);
    expect(textOf(done)).toContain("98111 22233 verified");
    const id = textOf(done).match(/UDS-\d{6}/)![0];
    const order = (await getOrder(id))!;
    expect(order).toMatchObject({ channel: "whatsapp", status: "kyc_verified", contact: { phone: "9811122233" } });
    expect(order.lines.length).toBeGreaterThan(0);

    expect(textOf(await type(from, "status"))).toContain(id);
  }, 60_000);

  it("carries on by itself when the missed call comes in", async () => {
    // Missed calls are offered only when a number is set up.
    process.env.MISSED_CALL_NUMBER = "080-4718-0000";
    onTestFinished(() => void delete process.env.MISSED_CALL_NUMBER);
    const from = "919812300000";
    await throughKyc(from);
    await tap(from, "phone:other");
    await type(from, "9812311111");

    const ask = await tap(from, "verify:missed_call");
    expect(textOf(ask)).toContain("080-4718-0000");
    expect(optionIds(ask)).not.toContain("verify:simulate");

    // The provider's webhook reports the caller; the waiting chat places the order.
    const verified = await recordMissedCall("+91-98123-11111");
    expect(verified.map((v) => v.waSession)).toEqual([sessionKey(from)]);
    await onPhoneVerified(sessionKey(from));
    expect(textOf(drainOutbox(from))).toMatch(/Order placed[\s\S]*UDS-\d{6}/);
  }, 60_000);

  it("uses the WhatsApp number itself without another check", async () => {
    const from = "919800011111";
    await throughKyc(from);
    expect(textOf(await tap(from, "phone:own"))).toContain("98000 11111");
  }, 60_000);

  it("forgets the chat on STOP and ignores repeated deliveries", async () => {
    const from = "919800022222";
    await handleIncoming({ id: "dup", from, text: "hi" });
    await handleIncoming({ id: "dup", from, text: "hi" });
    expect(drainOutbox(from)).toHaveLength(1);

    expect(textOf(await type(from, "STOP"))).toContain("deleted");
    expect(await getWaSession(sessionKey(from))).toBeUndefined();
  });
});

describe("phone verification", () => {
  it("limits attempts per code and starts per number", async () => {
    const phone = "9700000001";
    const first = await startVerification({ phone, method: "whatsapp" });
    if (!first.ok) throw new Error(first.error);
    for (let i = 0; i < 4; i++) expect(await checkCode(first.id, "abcdef")).toEqual({ ok: false, error: "wrong_code" });
    expect(await checkCode(first.id, "abcdef")).toEqual({ ok: false, error: "too_many" });
    // Even the right code is refused once the attempts are used up.
    expect(await checkCode(first.id, first.demoCode!)).toEqual({ ok: false, error: "too_many" });

    await startVerification({ phone, method: "voice" });
    await startVerification({ phone, method: "whatsapp" });
    expect(await startVerification({ phone, method: "whatsapp" })).toEqual({ ok: false, error: "rate_limited" });
  });

  it("ties a check and its token to one number", async () => {
    const r = await startVerification({ phone: "9700000002", method: "whatsapp" });
    if (!r.ok) throw new Error(r.error);
    const ok = await checkCode(r.id, r.demoCode!);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(verificationIsFor(ok.verification, "9700000002")).toBe(true);
      expect(verificationIsFor(ok.verification, "9700000003")).toBe(false);
    }
    const token = issuePhoneToken("9700000002");
    expect(checkPhoneToken("9700000002", token)).toBe(true);
    expect(checkPhoneToken("9700000003", token)).toBe(false);
    expect(checkPhoneToken("9700000002", `${Date.now() - 1}.${token.split(".")[1]}`)).toBe(false);
  });

  it("rejects bad numbers", async () => {
    expect(await startVerification({ phone: "12345", method: "whatsapp" })).toEqual({ ok: false, error: "invalid_phone" });
  });
});

describe("WhatsApp webhook", () => {
  it("checks Meta's signature", () => {
    const body = '{"entry":[]}';
    const sig = `sha256=${createHmac("sha256", "secret").update(body).digest("hex")}`;
    expect(validSignature(body, sig, "secret")).toBe(true);
    expect(validSignature(body, sig, "other")).toBe(false);
    expect(validSignature(body, null, "secret")).toBe(false);
  });

  it("reads text, taps, photos and voice notes, and skips receipts", () => {
    const msgs = parseWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "919876543210", profile: { name: "Ravi" } }],
                messages: [
                  { id: "a", from: "919876543210", type: "text", text: { body: "hello" } },
                  { id: "b", from: "919876543210", type: "interactive", interactive: { button_reply: { id: "lang:hi", title: "हिंदी" } } },
                  { id: "c", from: "919876543210", type: "image", image: { id: "m1", mime_type: "image/jpeg" } },
                  { id: "d", from: "919876543210", type: "audio", audio: { id: "m2", mime_type: "audio/ogg; codecs=opus" } },
                ],
                statuses: [{ id: "x", status: "read" }],
              },
            },
          ],
        },
      ],
    });
    expect(msgs).toEqual([
      { id: "a", from: "919876543210", profileName: "Ravi", text: "hello" },
      { id: "b", from: "919876543210", profileName: "Ravi", replyId: "lang:hi", text: "हिंदी" },
      { id: "c", from: "919876543210", profileName: "Ravi", media: { id: "m1", mime: "image/jpeg" }, text: undefined },
      { id: "d", from: "919876543210", profileName: "Ravi", media: { id: "m2", mime: "audio/ogg; codecs=opus" } },
    ]);
  });
});

describe("2Factor delivery", () => {
  function mock2Factor(reply: { Status: string; Details: string }) {
    process.env.TWOFACTOR_API_KEY = "test-key";
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } });
    });
    onTestFinished(() => {
      vi.unstubAllGlobals();
      delete process.env.TWOFACTOR_API_KEY;
    });
    return urls;
  }

  it("offers SMS only with a DLT template, since without one 2Factor calls instead", async () => {
    mock2Factor({ Status: "Success", Details: "session-1" });
    expect(verifyMethods()).toMatchObject({ sms: "off", voice: "live" });
    expect(await startVerification({ phone: "9700000010", method: "sms" })).toEqual({ ok: false, error: "unavailable" });
  });

  it("sends our own code by SMS and by voice call, and checks it here", async () => {
    const urls = mock2Factor({ Status: "Success", Details: "session-1" });
    process.env.TWOFACTOR_SMS_TEMPLATE = "UdyamOTP";
    onTestFinished(() => void delete process.env.TWOFACTOR_SMS_TEMPLATE);
    expect(verifyMethods().sms).toBe("live");
    const sms = await startVerification({ phone: "9700000011", method: "sms" });
    if (!sms.ok) throw new Error(sms.error);
    expect(sms.demo).toBe(false);
    expect(sms.demoCode).toBeUndefined();
    const [, code] = urls[0].match(/^https:\/\/2factor\.in\/API\/V1\/test-key\/SMS\/919700000011\/(\d{6})\/UdyamOTP$/)!;
    expect(await checkCode(sms.id, code)).toMatchObject({ ok: true });

    const voice = await startVerification({ phone: "9700000012", method: "voice" });
    expect(voice.ok).toBe(true);
    expect(urls[1]).toMatch(/\/VOICE\/919700000012\/\d{6}$/);
  });

  it("reports a refused send without counting it against the number", async () => {
    mock2Factor({ Status: "Error", Details: "Invalid API Key" });
    for (let i = 0; i < 4; i++) {
      expect(await startVerification({ phone: "9700000013", method: "voice" })).toEqual({ ok: false, error: "send_failed" });
    }
  });
});
