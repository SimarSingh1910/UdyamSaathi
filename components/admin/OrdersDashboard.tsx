"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInr } from "@/lib/i18n";
import { STATUS_FLOW, STATUS_LABEL, nextStatus } from "@/lib/order-flow";
import type { Order, OrderStatus } from "@/lib/store";
import { api } from "./AdminShell";

interface Stats {
  live: {
    orders: number;
    byStatus: Record<string, number>;
    monthlyRevenue: number;
    avgDaysToActivate: number | null;
    openRequests: number;
  };
  baseline: {
    activationRate: number;
    avgDaysToActivate: number;
    followUpCalls: number;
    costPerActivation: number;
    churn6m: number;
  };
}

const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

export default function OrdersDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all" | "open">("open");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [o, s] = await Promise.all([api<{ orders: Order[] }>("/api/admin/orders"), api<Stats>("/api/admin/stats")]);
    setOrders(o.orders);
    setStats(s);
  }, []);

  useEffect(() => {
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 10_000);
    return () => clearInterval(t);
  }, [load]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter === "open" && (o.status === "active" || o.status === "cancelled")) return false;
      if (filter !== "open" && filter !== "all" && o.status !== filter) return false;
      if (!term) return true;
      return [o.id, o.business.tradeName, o.business.city, o.contact.name].some((x) => x?.toLowerCase().includes(term));
    });
  }, [orders, filter, q]);

  async function advance(o: Order) {
    setBusy(o.id);
    try {
      await api(`/api/admin/orders/${o.id}`, { method: "PATCH", body: { action: "advance" } });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const b = stats?.baseline;
  const l = stats?.live;

  return (
    <section>
      <div className="kpis">
        <div className="kpi">
          <span>Orders</span>
          <strong>{l?.orders ?? "—"}</strong>
          <small>{l ? formatInr(l.monthlyRevenue) : "—"}/month booked</small>
        </div>
        <div className="kpi">
          <span>Days to activate</span>
          <strong>{l?.avgDaysToActivate != null ? l.avgDaysToActivate.toFixed(1) : "—"}</strong>
          <small>was {b ? b.avgDaysToActivate.toFixed(1) : "—"} days (Apr–Jun)</small>
        </div>
        <div className="kpi">
          <span>Status calls from customers</span>
          <strong>0</strong>
          <small>was {b ? b.followUpCalls.toFixed(1) : "—"} per customer · tracker replaces them</small>
        </div>
        <div className="kpi">
          <span>Help requests waiting</span>
          <strong>{l?.openRequests ?? "—"}</strong>
          <small>
            <Link href="/admin/leads">Open leads &amp; requests →</Link>
          </small>
        </div>
      </div>

      <div className="pipeline">
        {[...STATUS_FLOW, "cancelled" as const].map((s) => (
          <button key={s} className={`stage${filter === s ? " on" : ""}`} onClick={() => setFilter(s)}>
            <strong>{l?.byStatus[s] ?? 0}</strong>
            <span>{STATUS_LABEL[s].en}</span>
          </button>
        ))}
      </div>

      <div className="row toolbar">
        <div className="chips">
          {(["open", "all"] as const).map((f) => (
            <button key={f} className={`chip${filter === f ? " chip-on" : ""}`} onClick={() => setFilter(f)}>
              {f === "open" ? "Open orders" : "All orders"}
            </button>
          ))}
        </div>
        <input className="search" placeholder="Search order, business, city, contact" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Business</th>
            <th>Products</th>
            <th>Monthly</th>
            <th>Status</th>
            <th>Placed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shown.map((o) => {
            const next = nextStatus(o.status);
            return (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/orders/${o.id}`}>
                    <b>{o.id}</b>
                  </Link>
                </td>
                <td>
                  {o.business.tradeName}
                  <div className="muted small">
                    {o.business.businessType} · {o.business.city} · {o.contact.name} {o.contact.phone}
                  </div>
                </td>
                <td className="small">{o.lines.map((x) => `${x.name}${x.quantity > 1 ? ` ×${x.quantity}` : ""}`).join(", ")}</td>
                <td>{formatInr(o.monthlyTotal)}</td>
                <td>
                  <span className={`pill status-${o.status}`}>{STATUS_LABEL[o.status].en}</span>
                </td>
                <td className="small muted">{ago(o.createdAt)}</td>
                <td>
                  {next && o.status !== "cancelled" && (
                    <button className="btn btn-small" disabled={busy === o.id} onClick={() => advance(o)}>
                      → {STATUS_LABEL[next].en}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {!shown.length && (
            <tr>
              <td colSpan={7} className="muted">
                No orders here yet. Place one from <Link href="/start">/start</Link>.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
