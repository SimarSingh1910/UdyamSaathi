import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Keyed hashes and short signed tokens, derived from the store's encryption key so
 * there is one secret to manage. A different purpose gives an unrelated key.
 */

function keyFor(purpose: string): Buffer {
  const value = process.env.UDYAM_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("UDYAM_ENCRYPTION_KEY must be set to a 64-character hexadecimal key.");
  }
  return createHash("sha256").update(`${purpose}:`).update(Buffer.from(value, "hex")).digest();
}

/** Stable, non-reversible id for a value (a phone number, a WhatsApp id). */
export function keyedHash(purpose: string, value: string): string {
  return createHmac("sha256", keyFor(purpose)).update(value).digest("hex").slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** "<expiry>.<signature>": proves the server vouched for `subject` until expiry. */
export function signToken(purpose: string, subject: string, ttlMs: number): string {
  const exp = Date.now() + ttlMs;
  const sig = createHmac("sha256", keyFor(purpose)).update(`${subject}|${exp}`).digest("base64url");
  return `${exp}.${sig}`;
}

export function checkToken(purpose: string, subject: string, token: unknown): boolean {
  if (typeof token !== "string") return false;
  const [expRaw, sig] = token.split(".");
  const exp = Number(expRaw);
  if (!sig || !Number.isFinite(exp) || exp < Date.now()) return false;
  const want = createHmac("sha256", keyFor(purpose)).update(`${subject}|${exp}`).digest("base64url");
  return safeEqual(sig, want);
}
