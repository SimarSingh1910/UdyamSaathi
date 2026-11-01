"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInr } from "@/lib/i18n";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@/lib/product-input";
import type { StoredProduct } from "@/lib/store";
import { api } from "./AdminShell";

const SEGMENTS = [
  ["micro", "Micro retail"],
  ["prof", "Professional offices"],
  ["multi", "Multi-site"],
  ["mfg", "Manufacturers"],
] as const;

type Draft = Omit<StoredProduct, "id"> & { id?: string };

const EMPTY: Draft = {
  name: "",
  category: "Connectivity",
  description: "",
  unit: "per account",
  priceMin: 0,
  priceMax: 0,
  setupFee: 0,
  minContractMonths: 12,
  cityTiers: [1, 2],
  minEmployees: 1,
  minSites: 1,
  requiresGstin: false,
  requiresOneOf: [],
  installDays: 3,
  targetSegments: [],
  active: true,
};

export default function ServicesAdmin() {
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(() => api<{ products: StoredProduct[] }>("/api/admin/products").then((d) => setProducts(d.products)), []);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  async function save() {
    if (!draft) return;
    setError("");
    try {
      if (draft.id) await api(`/api/admin/products/${draft.id}`, { method: "PATCH", body: draft });
      else await api("/api/admin/products", { method: "POST", body: draft });
      setDraft(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function toggle(p: StoredProduct) {
    await api(`/api/admin/products/${p.id}`, { method: "PATCH", body: { active: !p.active } });
    await load();
  }

  async function remove(p: StoredProduct) {
    if (!confirm(`Delete ${p.name}? Existing orders keep it; new customers won't see it.`)) return;
    await api(`/api/admin/products/${p.id}`, { method: "DELETE" });
    await load();
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const term = q.trim().toLowerCase();
  const shown = products.filter((p) => !term || `${p.id} ${p.name} ${p.category}`.toLowerCase().includes(term));

  return (
    <section>
      <div className="row toolbar">
        <h2>Services catalogue</h2>
        <input className="search" placeholder="Search services" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-small" onClick={() => setDraft({ ...EMPTY })}>
          + Add service
        </button>
      </div>
      <p className="muted small">
        Changes go live immediately: the advisor, quote and eligibility rules use this list. Hidden services stay on existing
        orders but are not offered to new customers.
      </p>

      {draft && (
        <div className="card form editor">
          <h3>{draft.id ? `Edit ${draft.id}` : "New service"}</h3>
          <div className="grid3">
            <label className="span2">
              Name
              <input value={draft.name} onChange={(e) => set("name", e.target.value)} />
            </label>
            <label>
              Category
              <select value={draft.category} onChange={(e) => set("category", e.target.value)}>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="span3">
              Description (shown to owners)
              <input value={draft.description} onChange={(e) => set("description", e.target.value)} />
            </label>
            <label>
              Unit
              <select value={draft.unit} onChange={(e) => set("unit", e.target.value)}>
                {PRODUCT_UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </label>
            <label>
              Price min (₹/month)
              <input type="number" value={draft.priceMin} onChange={(e) => set("priceMin", Number(e.target.value))} />
            </label>
            <label>
              Price max (₹/month)
              <input type="number" value={draft.priceMax} onChange={(e) => set("priceMax", Number(e.target.value))} />
            </label>
            <label>
              Setup fee (₹, one-time)
              <input type="number" value={draft.setupFee} onChange={(e) => set("setupFee", Number(e.target.value))} />
            </label>
            <label>
              Min contract (months)
              <input type="number" value={draft.minContractMonths} onChange={(e) => set("minContractMonths", Number(e.target.value))} />
            </label>
            <label>
              Install time (days)
              <input type="number" value={draft.installDays} onChange={(e) => set("installDays", Number(e.target.value))} />
            </label>
            <label>
              Min employees
              <input type="number" value={draft.minEmployees} onChange={(e) => set("minEmployees", Number(e.target.value))} />
            </label>
            <label>
              Min sites
              <input type="number" value={draft.minSites} onChange={(e) => set("minSites", Number(e.target.value))} />
            </label>
            <div>
              City tiers
              <div className="chips">
                {[1, 2].map((t) => (
                  <button
                    type="button"
                    key={t}
                    className={`chip${draft.cityTiers.includes(t) ? " chip-on" : ""}`}
                    onClick={() => set("cityTiers", toggleIn(draft.cityTiers, t))}
                  >
                    Tier {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="span3">
              Best for
              <div className="chips">
                {SEGMENTS.map(([code, label]) => (
                  <button
                    type="button"
                    key={code}
                    className={`chip${draft.targetSegments.includes(code) ? " chip-on" : ""}`}
                    onClick={() => set("targetSegments", toggleIn(draft.targetSegments, code))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={draft.requiresGstin} onChange={(e) => set("requiresGstin", e.target.checked)} />
              Needs an active GSTIN
            </label>
            <div className="span3">
              Needs one of these in the same bundle (leave empty if standalone)
              <div className="chips">
                {products
                  .filter((p) => p.id !== draft.id && p.category === "Connectivity")
                  .map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className={`chip${draft.requiresOneOf.includes(p.id) ? " chip-on" : ""}`}
                      onClick={() => set("requiresOneOf", toggleIn(draft.requiresOneOf, p.id))}
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>
          {error && <p className="small fail">{error}</p>}
          <div className="row">
            <button className="btn btn-small" onClick={save}>
              Save
            </button>
            <button className="btn btn-ghost btn-small" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Service</th>
            <th>Price / month</th>
            <th>Setup</th>
            <th>Rules</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.id} className={p.active ? "" : "row-off"}>
              <td className="muted">{p.id}</td>
              <td>
                <b>{p.name}</b>
                <div className="muted small">
                  {p.category} · {p.unit}
                </div>
              </td>
              <td>
                {formatInr(p.priceMin)}–{formatInr(p.priceMax)}
              </td>
              <td>{p.setupFee ? formatInr(p.setupFee) : "—"}</td>
              <td className="small">
                {[
                  p.cityTiers.length === 1 ? `Tier ${p.cityTiers[0]} only` : null,
                  p.minEmployees > 1 ? `${p.minEmployees}+ staff` : null,
                  p.minSites > 1 ? `${p.minSites}+ sites` : null,
                  p.requiresGstin ? "GSTIN" : null,
                  p.requiresOneOf.length ? `needs ${p.requiresOneOf.join("/")}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </td>
              <td>
                <span className={`pill ${p.active ? "pill-active" : "pill-pending"}`}>{p.active ? "On sale" : "Hidden"}</span>
              </td>
              <td className="actions-cell">
                <button className="btn btn-ghost btn-small" onClick={() => setDraft({ ...p })}>
                  Edit
                </button>
                <button className="btn btn-ghost btn-small" onClick={() => toggle(p)}>
                  {p.active ? "Hide" : "Show"}
                </button>
                <button className="btn btn-ghost btn-small" onClick={() => remove(p)}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
