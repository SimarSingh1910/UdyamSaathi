import { createHmac } from "node:crypto";
import { safeEqual } from "../security/hash";
import type { Incoming } from "./bot";

/** Meta signs each webhook body with the app secret (X-Hub-Signature-256). */
export function validSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const want = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  return safeEqual(header, want);
}

interface WaMessage {
  id: string;
  from: string;
  type: string;
  text?: { body?: string };
  interactive?: { button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  button?: { text?: string; payload?: string };
  image?: { id: string; mime_type?: string; caption?: string };
  document?: { id: string; mime_type?: string };
  audio?: { id: string; mime_type?: string };
}

/** Owner messages in a webhook payload. Delivery and read receipts are ignored. */
export function parseWebhook(body: unknown): Incoming[] {
  const out: Incoming[] = [];
  const entries = (body as { entry?: { changes?: { value?: Record<string, unknown> }[] }[] })?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const contacts = (value.contacts as { wa_id?: string; profile?: { name?: string } }[] | undefined) ?? [];
      const names = new Map(contacts.map((c) => [c.wa_id, c.profile?.name]));
      for (const m of (value.messages as WaMessage[] | undefined) ?? []) {
        if (!m?.id || !/^\d{6,15}$/.test(m.from ?? "")) continue;
        const base: Incoming = { id: m.id, from: m.from, profileName: names.get(m.from) };
        const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
        if (m.type === "text") out.push({ ...base, text: m.text?.body ?? "" });
        else if (reply) out.push({ ...base, replyId: reply.id, text: reply.title });
        else if (m.type === "button") out.push({ ...base, replyId: m.button?.payload, text: m.button?.text });
        else if (m.image) out.push({ ...base, media: { id: m.image.id, mime: m.image.mime_type ?? "image/jpeg" }, text: m.image.caption });
        else if (m.document) out.push({ ...base, media: { id: m.document.id, mime: m.document.mime_type ?? "application/pdf" } });
        else if (m.audio) out.push({ ...base, media: { id: m.audio.id, mime: m.audio.mime_type ?? "audio/ogg" } });
        else out.push({ ...base, text: "" });
      }
    }
  }
  return out;
}
