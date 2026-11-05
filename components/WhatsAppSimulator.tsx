"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import type { OutMessage } from "@/lib/whatsapp/client";

type Bubble = { from: "me"; text: string; image?: string } | { from: "bot"; msg: OutMessage; used?: boolean };

/** WhatsApp's light formatting: *bold*, _italic_, and links. */
function Formatted({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\*[^*\n]+\*|_[^_\n]+_|https?:\/\/\S+)/g).map((part, j) => {
            if (/^\*[^*]+\*$/.test(part)) return <b key={j}>{part.slice(1, -1)}</b>;
            if (/^_[^_]+_$/.test(part)) return <i key={j}>{part.slice(1, -1)}</i>;
            if (/^https?:\/\//.test(part)) return <a key={j} href={part} target="_blank" rel="noreferrer">{part}</a>;
            return part;
          })}
        </Fragment>
      ))}
    </>
  );
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });

/**
 * A stand-in for the WhatsApp app while the Business API is not connected. Messages
 * go through the same bot as the real webhook; only delivery is simulated.
 */
export default function WhatsAppSimulator() {
  const [from, setFrom] = useState("919876543210");
  const [name, setName] = useState("Ravi Kumar");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openList, setOpenList] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [bubbles, busy]);

  const addBot = (msgs: OutMessage[]) =>
    msgs.length && setBubbles((b) => [...b, ...msgs.map((msg) => ({ from: "bot" as const, msg }))]);

  // The bot can also write on its own, e.g. once a missed call comes in.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (busy) return;
      const res = await fetch(`/api/whatsapp/simulate?from=${from}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) addBot((await res.json()).messages ?? []);
    }, 2500);
    return () => clearInterval(timer);
  }, [from, busy]);

  async function send(payload: { text?: string; replyId?: string; replyTitle?: string; image?: string }, shown: Bubble) {
    setBubbles((b) => [...b, shown]);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/whatsapp/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from, name, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      addBot(data.messages ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function tap(index: number, id: string, title: string) {
    setOpenList(null);
    setBubbles((b) => b.map((x, i) => (i === index && x.from === "bot" ? { ...x, used: true } : x)));
    send({ replyId: id, replyTitle: title }, { from: "me", text: title });
  }

  async function attach(f: File | undefined) {
    if (!f) return;
    const image = await readAsDataUrl(f);
    send({ image }, { from: "me", text: f.name, image: f.type.startsWith("image/") ? image : undefined });
    if (file.current) file.current.value = "";
  }

  return (
    <main className="wa">
      <header className="topbar">
        <Link href="/" className="brand">UdyamSaathi</Link>
        <span className="small muted">WhatsApp simulator</span>
      </header>
      <p className="small muted">
        Demo mode: WhatsApp isn&apos;t connected, so this page stands in for the app. The bot, advisor, KYC, phone checks and
        orders are the real ones. Type <b>hi</b> to start.
      </p>
      <div className="row wa-who">
        <label className="small">
          WhatsApp number
          <input value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} inputMode="numeric" />
        </label>
        <label className="small">
          Profile name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>

      <div className="wa-chat">
        {bubbles.map((b, i) =>
          b.from === "me" ? (
            <div key={i} className="wa-bubble wa-me">
              {b.image ? <img src={b.image} alt={b.text} className="wa-img" /> : <Formatted text={b.text} />}
            </div>
          ) : (
            <div key={i} className="wa-bubble wa-bot">
              <Formatted text={b.msg.text} />
              {b.msg.type === "buttons" && (
                <div className="wa-buttons">
                  {b.msg.buttons.map((btn) => (
                    <button key={btn.id} disabled={busy || b.used} onClick={() => tap(i, btn.id, btn.title)}>
                      {btn.title}
                    </button>
                  ))}
                </div>
              )}
              {b.msg.type === "list" && (
                <div className="wa-buttons">
                  <button disabled={busy || b.used} onClick={() => setOpenList(openList === i ? null : i)}>
                    ☰ {b.msg.button}
                  </button>
                  {openList === i &&
                    b.msg.rows.map((r) => (
                      <button key={r.id} className="wa-row" onClick={() => tap(i, r.id, r.title)}>
                        <span>{r.title}</span>
                        {r.description && <span className="small muted">{r.description}</span>}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ),
        )}
        {busy && <div className="wa-bubble wa-bot muted">…</div>}
        <div ref={end} />
      </div>

      {error && <p className="small fail">{error}</p>}
      <form
        className="wa-input"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t || busy) return;
          setText("");
          send({ text: t }, { from: "me", text: t });
        }}
      >
        <button type="button" className="btn btn-ghost" title="Send a photo" onClick={() => file.current?.click()} disabled={busy}>
          📎
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => attach(e.target.files?.[0])} />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" />
        <button className="btn" disabled={busy || !text.trim()}>
          Send
        </button>
      </form>
    </main>
  );
}
