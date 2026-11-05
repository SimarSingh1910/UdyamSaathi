import { randomBytes, randomInt } from "node:crypto";
import { maskPhone, normalizePhone } from "../order-flow";
import { checkToken, keyedHash, safeEqual, signToken } from "../security/hash";
import {
  addVerification,
  getVerification,
  recentVerifications,
  updateVerification,
  type PhoneVerification,
  type VerifyMethod,
} from "../store";
import { sendOtpTemplate, whatsappOtpLive } from "../whatsapp/client";

/**
 * Proves the owner has the phone they gave us, by one of two methods they choose:
 * - WhatsApp code: a 6-digit code sent with an approved authentication template.
 * - Missed call: they ring our number from theirs; the telephony provider tells us
 *   the caller's number through a webhook (Exotel, Knowlarity, 2Factor and others).
 * In demo mode (no provider set up) the code is shown on screen and the missed call
 * can be simulated, so the journey can be tried end to end.
 */

export const CHECK_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
/** Checks one number can start in the rate-limit window. */
const MAX_STARTS = 3;
/** A verified number is good for placing the order for this long. */
const TOKEN_TTL_MS = 30 * 60_000;

const phoneHash = (phone: string) => keyedHash("phone", phone);
const codeHash = (id: string, code: string) => keyedHash(`otp:${id}`, code);

export const missedCallNumber = () => process.env.MISSED_CALL_NUMBER?.trim() || "";

/** Demo shortcuts are on in development and off in production unless asked for. */
export function demoAllowed(): boolean {
  const flag = process.env.PHONE_VERIFY_DEMO;
  if (flag === "1") return true;
  if (flag === "0") return false;
  return process.env.NODE_ENV !== "production";
}

export function verifyMethods(): Record<VerifyMethod, "live" | "demo" | "off"> {
  const mode = (live: boolean) => (live ? "live" : demoAllowed() ? "demo" : "off");
  return { whatsapp: mode(whatsappOtpLive()), missed_call: mode(Boolean(missedCallNumber())) };
}

export type StartResult =
  | {
      ok: true;
      id: string;
      method: VerifyMethod;
      expiresAt: number;
      /** For missed calls: the number to ring. */
      callNumber?: string;
      /** Demo mode only: the code that would have been sent. */
      demoCode?: string;
      demo: boolean;
    }
  | { ok: false; error: "invalid_phone" | "unavailable" | "rate_limited" | "send_failed" };

export async function startVerification(args: {
  phone: string;
  method: VerifyMethod;
  waSession?: string;
}): Promise<StartResult> {
  const phone = normalizePhone(args.phone);
  if (!phone) return { ok: false, error: "invalid_phone" };
  const mode = verifyMethods()[args.method];
  if (mode === "off") return { ok: false, error: "unavailable" };

  const hash = phoneHash(phone);
  const recent = await recentVerifications(hash, Date.now() - CHECK_TTL_MS);
  if (recent.length >= MAX_STARTS) return { ok: false, error: "rate_limited" };

  const now = Date.now();
  const v: PhoneVerification = {
    id: `VER-${randomBytes(9).toString("base64url")}`,
    phoneHash: hash,
    method: args.method,
    attempts: 0,
    createdAt: now,
    expiresAt: now + CHECK_TTL_MS,
    waSession: args.waSession,
  };

  let demoCode: string | undefined;
  if (args.method === "whatsapp") {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    v.codeHash = codeHash(v.id, code);
    if (mode === "live") {
      if (!(await sendOtpTemplate(`91${phone}`, code))) return { ok: false, error: "send_failed" };
    } else {
      demoCode = code;
    }
  }

  await addVerification(v);
  console.info(`[verify] ${v.id} ${args.method} (${mode}) for ${maskPhone(phone)}`);
  return {
    ok: true,
    id: v.id,
    method: args.method,
    expiresAt: v.expiresAt,
    callNumber: args.method === "missed_call" ? missedCallNumber() || "1800-000-0000" : undefined,
    demoCode,
    demo: mode === "demo",
  };
}

export type CheckResult =
  | { ok: true; verification: PhoneVerification }
  | { ok: false; error: "not_found" | "expired" | "wrong_code" | "too_many" };

export async function checkCode(id: string, code: string): Promise<CheckResult> {
  const clean = code.replace(/\D/g, "");
  let result: CheckResult = { ok: false, error: "not_found" };
  // Decide inside the row lock, so parallel guesses can't get past the attempt limit.
  await updateVerification(id, (v) => {
    if (v.method !== "whatsapp" || !v.codeHash) result = { ok: false, error: "not_found" };
    else if (v.verifiedAt) result = { ok: true, verification: v };
    else if (v.expiresAt < Date.now()) result = { ok: false, error: "expired" };
    else if (v.attempts >= MAX_ATTEMPTS) result = { ok: false, error: "too_many" };
    else {
      v.attempts += 1;
      if (clean.length === 6 && safeEqual(codeHash(id, clean), v.codeHash)) {
        v.verifiedAt = Date.now();
        result = { ok: true, verification: v };
      } else {
        result = { ok: false, error: v.attempts >= MAX_ATTEMPTS ? "too_many" : "wrong_code" };
      }
    }
  });
  return result;
}

/**
 * A missed call came in. Marks every open missed-call check for that number as
 * verified and returns them, so waiting chats can carry on.
 */
export async function recordMissedCall(rawCaller: string): Promise<PhoneVerification[]> {
  const phone = normalizePhone(rawCaller);
  if (!phone) return [];
  const now = Date.now();
  const open = (await recentVerifications(phoneHash(phone), now - CHECK_TTL_MS)).filter(
    (v) => v.method === "missed_call" && !v.verifiedAt && v.expiresAt > now,
  );
  const verified = await Promise.all(open.map((v) => updateVerification(v.id, (x) => (x.verifiedAt ??= now))));
  return verified.filter((v): v is PhoneVerification => Boolean(v));
}

/** Demo mode: pretend the missed call for this check came in. */
export async function simulateMissedCall(id: string): Promise<PhoneVerification | null> {
  if (verifyMethods().missed_call !== "demo") return null;
  const v = await getVerification(id);
  if (!v || v.method !== "missed_call" || v.expiresAt < Date.now()) return null;
  return (await updateVerification(id, (x) => (x.verifiedAt ??= Date.now()))) ?? null;
}

export async function verificationStatus(id: string): Promise<"pending" | "verified" | "expired" | "not_found"> {
  const v = await getVerification(id);
  if (!v) return "not_found";
  if (v.verifiedAt) return "verified";
  return v.expiresAt < Date.now() ? "expired" : "pending";
}

/** Does this check belong to this number? (Checks keep only a hash of it.) */
export function verificationIsFor(v: PhoneVerification, phone: string): boolean {
  const p = normalizePhone(phone);
  return Boolean(p) && safeEqual(v.phoneHash, phoneHash(p!));
}

/** Short-lived proof, handed to the browser, that this number was verified. */
export const issuePhoneToken = (phone: string) => signToken("phone-verified", phone, TOKEN_TTL_MS);
export const checkPhoneToken = (phone: string, token: unknown) => checkToken("phone-verified", phone, token);
