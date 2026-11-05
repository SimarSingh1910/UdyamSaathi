"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInr } from "@/lib/i18n";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@/lib/product-input";
import type { StoredProduct } from "@/lib/store";
import { api } from "./AdminShell";
import { Icon } from "./icons";
import Select from "./Select";

const SEGMENTS = [
  ["micro", "Micro retail"],
  ["prof", "Professional offices"],
  ["multi", "Multi-site"],
  ["mfg", "Manufacturers"],
] as const;

type Draft = Omit<StoredProduct, "id"> & { id?: string };
type Show = "all" | "on" | "hidden";

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

/** Eligibility rules as short tags; an empty list means anyone can buy it. */
function ruleTags(p: StoredProduct): string[] {
  return [
    p.cityTiers.length === 1 ? `Tier ${p.cityTiers[0]} only` : null,
    p.minEmployees > 1 ? `${p.minEmployees}+ staff` : null,
    p.minSites > 1 ? `${p.minSites}+ sites` : null,
    p.requiresGstin ? "GSTIN" : null,
  ].filter((x): x is string => Boolean(x));
}

export default function ServicesAdmin() {
  const [products, setProducts] = useState<StoredProduct[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Record<string, Show>>({});
  const [menu, setMenu] = useState<string | null>(null);

  const load = useCallback(() => api<{ products: StoredProduct[] }>("/api/admin/products").then((d) => setProducts(d.products)), []);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".ad-menu")) setMenu(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

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
    setMenu(null);
    if (!confirm(`Delete ${p.name}? Existing orders keep it; new customers won't see it.`)) return;
    await api(`/api/admin/products/${p.id}`, { method: "DELETE" });
    await load();
  }

  function edit(d: Draft) {
    setMenu(null);
    setError("");
    setDraft(d);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const term = q.trim().toLowerCase();
  const matching = products.filter((p) => !term || `${p.id} ${p.name} ${p.category}`.toLowerCase().includes(term));
  const byId = new Map(products.map((p) => [p.id, p]));
  const categories = [...PRODUCT_CATEGORIES, ...new Set(products.map((p) => p.category).filter((c) => !PRODUCT_CATEGORIES.includes(c)))];

  return (
    <section>
      <div className="ad-head">
        <div>
          <h1>Services catalogue</h1>
          <p>Everything the advisor can recommend, quote and sell.</p>
        </div>
        <div className="ad-head-tools">
          <label className="ad-search">
            <Icon name="search" />
            <input placeholder="Name or ID, e.g. P05" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <button className="ad-btn ad-btn-primary" onClick={() => edit({ ...EMPTY })}>
            <Icon name="plus" /> Add service
          </button>
        </div>
      </div>

      <div className="ad-info">
        <Icon name="bolt" />
        <p>
          <b>Changes go live immediately.</b> The advisor, quotes and eligibility rules all read from this list. Turning a service off
          hides it from new customers. Existing orders keep it.
        </p>
      </div>

      {draft && (
        <div className="ad-card ad-form editor">
          <h3>{draft.id ? `Edit ${draft.id}` : "New service"}</h3>
          <div className="grid3">
            <label className="span2">
              Name
              <input value={draft.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </label>
            <label>
              Category
              <Select value={draft.category} neutral={draft.category} onChange={(v) => set("category", v)} options={[...PRODUCT_CATEGORIES]} />
            </label>
            <label className="span3">
              Description (shown to owners)
              <input value={draft.description} onChange={(e) => set("description", e.target.value)} />
            </label>
            <label>
              Unit
              <Select value={draft.unit} neutral={draft.unit} onChange={(v) => set("unit", v)} options={[...PRODUCT_UNITS]} />
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
            <div className="ad-field">
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
            <div className="span3 ad-field">
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
            <div className="span3 ad-field">
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
            <button className="ad-btn ad-btn-primary" onClick={save}>
              Save
            </button>
            <button className="ad-btn" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {categories.map((cat) => {
        const inCat = matching.filter((p) => p.category === cat);
        if (!inCat.length) return null;
        const mode = show[cat] ?? "all";
        const rows = inCat.filter((p) => mode === "all" || (mode === "on" ? p.active : !p.active));
        const onSale = rows.filter((p) => p.active).length;
        return (
          <div key={cat} className="ad-card ad-table-card ad-svc-card">
            <div className="ad-table-head">
              <div>
                <b>{cat}</b>{" "}
                <span className="ad-note">
                  {onSale} of {rows.length} shown {onSale === 1 ? "is" : "are"} on sale
                </span>
              </div>
              <div className="ad-seg">
                {(
                  [
                    ["all", "All"],
                    ["on", "On sale"],
                    ["hidden", "Hidden"],
                  ] as const
                ).map(([m, label]) => (
                  <button key={m} className={mode === m ? "on" : ""} onClick={() => setShow((s) => ({ ...s, [cat]: m }))}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <table className="ad-table ad-services">
              <thead>
                <tr>
                  <th>Service</th>
                  <th className="num">Price / month</th>
                  <th className="num">Setup</th>
                  <th>Who can buy it</th>
                  <th>On sale</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const tags = ruleTags(p);
                  return (
                    <tr key={p.id} className={p.active ? "" : "off"}>
                      <td>
                        <b>{p.name}</b> <span className="ad-id">{p.id}</span>
                        <div className="ad-muted">Billed {p.unit}</div>
                      </td>
                      <td className="num">
                        <b>
                          {formatInr(p.priceMin)}–{formatInr(p.priceMax)}
                        </b>
                      </td>
                      <td className="num">{p.setupFee ? <b>{formatInr(p.setupFee)}</b> : <span className="ad-quiet-text">None</span>}</td>
                      <td>
                        {tags.length > 0 && (
                          <div className="ad-rules">
                            {tags.map((t) => (
                              <span key={t} className="ad-rule">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {p.requiresOneOf.length > 0 && (
                          <div className="ad-needs">
                            <span className="ad-muted">Needs one of</span>
                            <div className="ad-chips">
                              {p.requiresOneOf.map((id) => (
                                <span key={id} className="ad-chip">
                                  <code>{id}</code> {byId.get(id)?.name ?? ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {!tags.length && !p.requiresOneOf.length && <span className="ad-muted">Any business</span>}
                      </td>
                      <td>
                        <button
                          className={`ad-switch${p.active ? " on" : ""}`}
                          role="switch"
                          aria-checked={p.active}
                          aria-label={`${p.name} on sale`}
                          onClick={() => toggle(p)}
                        >
                          <i />
                          <span>{p.active ? "On sale" : "Hidden"}</span>
                        </button>
                      </td>
                      <td>
                        <div className="ad-row-actions">
                          <button className="ad-btn" onClick={() => edit({ ...p })}>
                            <Icon name="pencil" size={14} /> Edit
                          </button>
                          <div className="ad-menu">
                            <button className="ad-icon-btn" aria-label="More actions" onClick={() => setMenu(menu === p.id ? null : p.id)}>
                              <Icon name="dots" />
                            </button>
                            {menu === p.id && (
                              <div className="ad-menu-list" role="menu">
                                <button role="menuitem" className="danger" onClick={() => remove(p)}>
                                  Delete service
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="ad-empty">
                      {mode === "hidden" ? "No hidden services here." : "Nothing on sale here."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
      {products.length > 0 && !matching.length && <div className="ad-card ad-empty">No services match “{q}”.</div>}
    </section>
  );
}
