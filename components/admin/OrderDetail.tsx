"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatInr } from "@/lib/i18n";
import { LINE_LABEL, STATUS_FLOW, STATUS_LABEL, isOpen } from "@/lib/order-flow";
import type { LineStatus, Order } from "@/lib/store";
import { api } from "./AdminShell";

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

export default function OrderDetail({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [date, setDate] = useState(tomorrow());
  const [engineer, setEngineer] = useState("");
  const [note, setNote] = useState("");
  const [phone, setPhone] = useState<string | null>(null);

  const load = useCallback(() => api<Order>(`/api/admin/orders/${id}`).then(setOrder), [id]);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function act(body: Record<string, unknown>) {
    setError("");
    try {
      setOrder(await api<Order>(`/api/admin/orders/${id}`, { method: "PATCH", body }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!order) return <section>{error ? <p className="fail">{error}</p> : <p className="muted">Loading…</p>}</section>;

  const open = isOpen(order.status);
  const idx = STATUS_FLOW.indexOf(order.status);

  return (
    <section className="detail">
      <p className="small">
        <Link href="/admin">← All orders</Link>
      </p>
      <div className="row detail-head">
        <div>
          <h1>{order.business.tradeName}</h1>
          <p className="muted">
            {order.id} · {order.business.businessType} · {order.business.city} · {order.business.employees} people ·{" "}
            {order.business.sites} site(s)
            {order.business.gstinMasked && ` · GSTIN ${order.business.gstinMasked}`}
          </p>
        </div>
        <span className={`pill big status-${order.status}`}>{STATUS_LABEL[order.status].en}</span>
      </div>

      {error && <p className="card warn-card small">{error}</p>}

      <div className="grid2">
        <div>
          <div className="card">
            <h3>Progress</h3>
            <div className="steps">
              {STATUS_FLOW.map((s, i) => (
                <button
                  key={s}
                  className={`stepbtn${i <= idx ? " done" : ""}`}
                  disabled={!open || i <= idx}
                  onClick={() => act({ action: "status", status: s })}
                  title={i > idx ? `Move to ${STATUS_LABEL[s].en}` : ""}
                >
                  {STATUS_LABEL[s].en}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>Products</h3>
            {order.lines.map((l) => (
              <div key={l.productId} className="item-head line">
                <span>
                  {l.name} {l.quantity > 1 && <span className="muted">× {l.quantity}</span>}
                  <div className="muted small">
                    {formatInr(l.monthly)}/month · usually {l.installDays} day(s) to install
                  </div>
                </span>
                <select
                  value={l.status}
                  disabled={!open}
                  onChange={(e) => act({ action: "line", productId: l.productId, status: e.target.value as LineStatus })}
                >
                  {(Object.keys(LINE_LABEL) as LineStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {LINE_LABEL[s].en}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <p className="small muted">
              {formatInr(order.monthlyTotal)}/month incl. GST · setup {formatInr(order.setupTotal)} ·{" "}
              {order.contractMonths}-month contract
            </p>
          </div>

          {open && (
            <div className="card form">
              <h3>Book installation</h3>
              <div className="row">
                <label>
                  Date
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="grow">
                  Engineer
                  <input value={engineer} onChange={(e) => setEngineer(e.target.value)} placeholder="e.g. Ravi Kumar" />
                </label>
              </div>
              <button className="btn btn-small" onClick={() => act({ action: "schedule", date, engineer })}>
                Book &amp; notify customer
              </button>
              {order.installSlot && (
                <p className="small muted">
                  Booked: {order.installSlot}
                  {order.engineer && ` · ${order.engineer}`}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <h3>Contact</h3>
            <p>
              {order.contact.name} · {phone ?? order.contact.phone}
            </p>
            {!phone && (
              <button
                className="btn btn-ghost btn-small"
                onClick={async () => {
                  const r = await api<{ phone: string }>(`/api/admin/orders/${id}`, {
                    method: "PATCH",
                    body: { action: "reveal_phone" },
                  });
                  setPhone(r.phone);
                  load();
                }}
              >
                Show full number (logged)
              </button>
            )}
          </div>

          <div className="card form">
            <h3>Add a note</h3>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible to the customer on their tracker" />
            <div className="row">
              <button
                className="btn btn-small"
                disabled={!note.trim()}
                onClick={async () => {
                  await act({ action: "note", text: note });
                  setNote("");
                }}
              >
                Add note
              </button>
              {open && (
                <button
                  className="btn btn-ghost btn-small"
                  onClick={() => {
                    const reason = prompt("Reason for cancelling?");
                    if (reason !== null) act({ action: "cancel", reason });
                  }}
                >
                  Cancel order
                </button>
              )}
            </div>
          </div>

          <div className="card">
            <h3>History</h3>
            {[...order.events].reverse().map((e, i) => (
              <p key={i} className="small">
                <span className="muted">
                  {new Date(e.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}{" "}
                  · {e.by}
                </span>
                <br />
                {e.note.en}
              </p>
            ))}
          </div>

          <p className="small">
            <Link href={`/track/${order.id}`} target="_blank">
              Open the customer&apos;s tracker ↗
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
