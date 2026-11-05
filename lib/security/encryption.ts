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
