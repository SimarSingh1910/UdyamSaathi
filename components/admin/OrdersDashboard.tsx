"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatInr } from "@/lib/i18n";
import { STATUS_FLOW, STATUS_LABEL } from "@/lib/order-flow";
import type { Order, OrderStatus } from "@/lib/store";
import { api } from "./AdminShell";
import { Icon, type IconName } from "./icons";
import Select from "./Select";

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

type Filter = OrderStatus | "all" | "open";
type Sort = "oldest" | "newest" | "value";

const STAGES: OrderStatus[] = [...STATUS_FLOW, "cancelled"];
const PAGE = 10;

/** What the table heading says about the orders in each view. */
const VIEW_NOTE: Record<Filter, (n: number) => string> = {
  open: (n) => `${n} ${n === 1 ? "order" : "orders"} still in progress`,
  all: (n) => `${n} ${n === 1 ? "order" : "orders"}`,
  placed: (n) => `${n} ${n === 1 ? "order" : "orders"} waiting for KYC`,
  kyc_verified: (n) => `${n} ${n === 1 ? "order" : "orders"} waiting for an installation slot`,
  scheduled: (n) => `${n} ${n === 1 ? "installation" : "installations"} booked`,
  installing: (n) => `${n} ${n === 1 ? "order" : "orders"} with an engineer on site`,
  active: (n) => `${n} ${n === 1 ? "order" : "orders"} with every service live`,
  cancelled: (n) => `${n} cancelled`,
};

/** The next thing staff do for an order: advance it here, or open it to book a slot. */
const NEXT_STEP: Record<OrderStatus, { label: string; icon: IconName; advance: boolean }> = {
  placed: { label: "Verify KYC", icon: "check", advance: true },
  kyc_verified: { label: "Book installation", icon: "calendar", advance: false },
  scheduled: { label: "Engineer on site", icon: "wrench", advance: true },
  installing: { label: "Mark all active", icon: "check", advance: true },
  active: { label: "View order", icon: "eye", advance: false },
  cancelled: { label: "View order", icon: "eye", advance: false },
};

const ago = (ms: number) => {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

export default function OrdersDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [sort, setSort] = useState<Sort>("oldest");
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
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

  const pick = (f: Filter) => {
    setFilter(f);
    setShowAll(false);
  };

  const matching = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = orders.filter((o) => {
      if (filter === "open" && (o.status === "active" || o.status === "cancelled")) return false;
      if (filter !== "open" && filter !== "all" && o.status !== filter) return false;
      if (!term) return true;
      return [o.id, o.business.tradeName, o.business.city, o.contact.name].some((x) => x?.toLowerCase().includes(term));
    });
    const by: Record<Sort, (a: Order, b: Order) => number> = {
      oldest: (a, b) => a.createdAt - b.createdAt,
      newest: (a, b) => b.createdAt - a.createdAt,
      value: (a, b) => b.monthlyTotal - a.monthlyTotal,
    };
    return [...list].sort(by[sort]);
  }, [orders, filter, q, sort]);
  const shown = showAll ? matching : matching.slice(0, PAGE);

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
  const booked = orders.filter((o) => o.status !== "cancelled").length;
  const faster = l?.avgDaysToActivate != null && b ? b.avgDaysToActivate - l.avgDaysToActivate : null;
  const total = l?.orders ?? 0;
  const title = filter === "open" ? "Open orders" : filter === "all" ? "All orders" : STATUS_LABEL[filter].en;

  return (
    <section>
      <div className="ad-head">
        <div>
          <h1>Orders</h1>
          <p>Business bundles, from order placed to every service live.</p>
        </div>
        <div className="ad-head-tools">
          <label className="ad-search">
            <Icon name="search" />
            <input placeholder="Order ID, business, city or contact" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="ad-seg">
            {(["open", "all"] as const).map((f) => (
              <button key={f} className={filter === f ? "on" : ""} onClick={() => pick(f)}>
                {f === "open" ? "Open" : "All orders"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="ad-kpis">
        <div className="ad-card ad-kpi">
          <span className="ad-kpi-label">Booked monthly revenue</span>
          <strong>{l ? formatInr(l.monthlyRevenue) : "—"}</strong>
          <small>
            across {booked} {booked === 1 ? "order" : "orders"}
          </small>
        </div>
        <div className="ad-card ad-kpi">
          <span className="ad-kpi-label">Days to activate</span>
          <div className="ad-kpi-value">
            <strong>{l?.avgDaysToActivate != null ? l.avgDaysToActivate.toFixed(1) : "—"}</strong>
            {faster != null && faster > 0 && (
              <span className="ad-delta">
                <Icon name="arrowDown" size={13} /> {faster.toFixed(1)} days
              </span>
            )}
          </div>
          <small>was {b ? b.avgDaysToActivate.toFixed(1) : "—"} days in Apr–Jun</small>
        </div>
        <div className="ad-card ad-kpi">
          <span className="ad-kpi-label">Status calls per customer</span>
          <div className="ad-kpi-value">
            <strong>0</strong>
            <span className="ad-was">was {b ? b.followUpCalls.toFixed(1) : "—"}</span>
          </div>
          <small>The live order tracker answers them</small>
        </div>
        <div className="ad-card ad-kpi ad-kpi-amber">
          <span className="ad-kpi-label">Help requests waiting</span>
          <strong>{l?.openRequests ?? "—"}</strong>
          <Link href="/admin/leads?tab=requests" className="ad-kpi-link">
            Review requests <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      </div>

      <div className="ad-card ad-pipeline">
        <div className="ad-pipeline-head">
          <b>Pipeline</b>
          <span>
            {total} {total === 1 ? "order" : "orders"} · pick a stage to filter the table
          </span>
        </div>
        <div className="ad-bar">
          {STAGES.filter((s) => (l?.byStatus[s] ?? 0) > 0).map((s) => (
            <span key={s} className={`ad-bar-seg st-${s}`} style={{ flexGrow: l?.byStatus[s] ?? 0 }} />
          ))}
        </div>
        <div className="ad-stages">
          {STAGES.map((s) => (
            <button key={s} className={`ad-stage st-${s}${filter === s ? " on" : ""}`} onClick={() => pick(filter === s ? "open" : s)}>
              <span className="ad-stage-name">
                <i className="ad-dot" /> {STATUS_LABEL[s].en}
              </span>
              <strong>{l?.byStatus[s] ?? 0}</strong>
            </button>
          ))}
        </div>
      </div>

      <div className="ad-card ad-table-card">
        <div className="ad-table-head">
          <div>
            <b>{title}</b> <span className="ad-note">{VIEW_NOTE[filter](matching.length)}</span>
          </div>
          <label className="ad-sort">
            Sort
            <Select
              value={sort}
              neutral="oldest"
              label="Sort"
              onChange={(v) => setSort(v as Sort)}
              options={[
                { value: "oldest", label: "Oldest first" },
                { value: "newest", label: "Newest first" },
                { value: "value", label: "Highest monthly value" },
              ]}
            />
          </label>
        </div>
        <table className="ad-table ad-orders">
          <thead>
            <tr>
              <th>Order</th>
              <th>Business</th>
              <th>Bundle</th>
              <th className="num">Monthly</th>
              <th>Progress</th>
              <th className="num">Next step</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => {
              const step = STATUS_FLOW.indexOf(o.status) + 1;
              const next = NEXT_STEP[o.status];
              const extra = o.lines.length - 3;
              return (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/orders/${o.id}`} className="ad-order-id">
                      {o.id}
                    </Link>
                    <div className="ad-muted">Placed {ago(o.createdAt)}</div>
                  </td>
                  <td>
                    <b>{o.business.tradeName}</b>
                    <div className="ad-muted">
                      {o.business.businessType} · {o.business.city || "—"}
                    </div>
                    <div className="ad-muted">
                      {o.contact.name} · {o.contact.phone}
                    </div>
                  </td>
                  <td>
                    <div className="ad-count-line">
                      {o.lines.length} {o.lines.length === 1 ? "product" : "products"}
                    </div>
                    <div className="ad-chips">
                      {o.lines.slice(0, 3).map((x) => (
                        <span key={x.productId} className="ad-chip">
                          {x.name}
                          {x.quantity > 1 && <em> ×{x.quantity}</em>}
                        </span>
                      ))}
                      {extra > 0 && <span className="ad-chip ad-chip-more">+{extra} more</span>}
                    </div>
                  </td>
                  <td className="num">
                    <b>{formatInr(o.monthlyTotal)}</b>
                    <div className="ad-muted">per month</div>
                  </td>
                  <td>
                    <span className={`ad-pill st-${o.status}`}>{STATUS_LABEL[o.status].en}</span>
                    {o.status !== "cancelled" && (
                      <>
                        <div className="ad-steps" aria-hidden="true">
                          {STATUS_FLOW.map((s, i) => (
                            <i key={s} className={i < step ? "on" : ""} />
                          ))}
                        </div>
                        <div className="ad-muted">
                          Step {step} of {STATUS_FLOW.length}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="num">
                    {next.advance ? (
                      <button className="ad-btn" disabled={busy === o.id} onClick={() => advance(o)}>
                        <Icon name={next.icon} /> {next.label}
                      </button>
                    ) : (
                      <Link href={`/admin/orders/${o.id}`} className="ad-btn">
                        <Icon name={next.icon} /> {next.label}
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {!shown.length && (
              <tr>
                <td colSpan={6} className="ad-empty">
                  No orders here yet. Place one from <Link href="/start">/start</Link>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {matching.length > 0 && (
          <div className="ad-table-foot">
            <span>
              Showing {shown.length} of {matching.length}
            </span>
            {matching.length > shown.length && (
              <button className="ad-btn" onClick={() => setShowAll(true)}>
                Show all {matching.length}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
