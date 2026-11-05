import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const FORMAT = "udyamsaathi-encrypted-store-v1";

function getKey(): Buffer {
  const value = process.env.UDYAM_ENCRYPTION_KEY;

  if (!value || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(
      "UDYAM_ENCRYPTION_KEY must be set to a 64-character hexadecimal key."
    );
  }

  return Buffer.from(value, "hex");
}

export function encryptStore(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);

  return JSON.stringify({
    format: FORMAT,
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: encrypted.toString("hex"),
  });
}

export function isEncryptedStore(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { format?: string }).format === FORMAT
  );
}

export function decryptStore<T>(value: {
  iv: string;
  tag: string;
  data: string;
}): T {
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getKey(),
      Buffer.from(value.iv, "hex")
    );
    decipher.setAuthTag(Buffer.from(value.tag, "hex"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(value.data, "hex")),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    throw new Error(
      "Cannot decrypt the UdyamSaathi database. Check the encryption key; the file may be damaged. The original file has been preserved."
    );
  }
}

const VALUE_PREFIX = "enc1";

/** One value (a phone number, a chat), AES-256-GCM with a fresh IV: "enc1:<iv>:<tag>:<data>". */
export function encryptValue(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VALUE_PREFIX, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

export function decryptValue(value: string): string {
  const [prefix, iv, tag, data] = value.split(":");
  if (prefix !== VALUE_PREFIX || !iv || !tag || data === undefined) {
    throw new Error("Value is not in the encrypted format.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Cannot decrypt a stored value. Check UDYAM_ENCRYPTION_KEY.");
  }
}
