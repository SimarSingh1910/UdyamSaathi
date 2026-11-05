"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInr } from "@/lib/i18n";
import type { ScoredLead } from "@/lib/leads";
import type { HelpRequest, LeadActionStatus, RequestStatus } from "@/lib/store";
import { api } from "./AdminShell";
import { Icon } from "./icons";
import Select from "./Select";

interface LeadsResponse {
  total: number;
  leads: ScoredLead[];
  model: { holdoutAuc: number; baseRate: number; trainedOn: number };
  facets: { segments: string[]; cities: string[]; stages: string[] };
  options: { businessTypes: string[]; sources: string[]; internet: string[]; turnover: string[]; languages: string[] };
}

const EMPTY_LEAD = {
  businessName: "",
  businessType: "",
  city: "",
  contactName: "",
  phone: "",
  language: "Hindi",
  source: "Field sales",
  employees: "1",
  sites: "1",
  hasGstin: false,
  hasUdyam: false,
  currentInternet: "Mobile hotspot",
  telecomSpend: "",
  turnover: "< 40 lakh",
  note: "",
};
type LeadDraft = typeof EMPTY_LEAD;

const LEAD_STATUS: Record<LeadActionStatus, string> = {
  to_call: "To call",
  called: "Called",
  won: "Won",
  not_interested: "Not interested",
};
const REQ_STATUS: Record<RequestStatus, string> = { new: "New", assigned: "Assigned", contacted: "Contacted", resolved: "Resolved" };
const PARTNERS = ["Field sales: North", "Field sales: West", "Partner: Sharma Telecom", "Partner: Digital Dukaan", "Inside sales"];
const PAGE = 25;
const PARTNER_OPTIONS = [{ value: "", label: "Unassigned" }, ...PARTNERS];
const LEAD_STATUS_OPTIONS = (Object.keys(LEAD_STATUS) as LeadActionStatus[]).map((s) => ({ value: s, label: LEAD_STATUS[s] }));

const pct = (p: number) => `${Math.round(p * 100)}%`;
const count = (n: number) => n.toLocaleString("en-IN");

export default function LeadsAdmin() {
  const [tab, setTab] = useState<"leads" | "requests">("leads");
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [filters, setFilters] = useState({ segment: "", city: "", stage: "", status: "open", sort: "probability" });
  const [limit, setLimit] = useState(PAGE);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTo, setBulkTo] = useState(PARTNERS[0]);
  const [menu, setMenu] = useState<string | null>(null);
  const [draft, setDraft] = useState<LeadDraft | null>(null);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "requests") setTab("requests");
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".ad-menu")) setMenu(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

  const loadRequests = useCallback(
    () => api<{ requests: HelpRequest[] }>("/api/admin/requests").then((d) => setRequests(d.requests)),
    [],
  );
  const loadLeads = useCallback(() => {
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    q.set("limit", String(limit));
    return api<LeadsResponse>(`/api/admin/leads?${q}`).then(setData);
  }, [filters, limit]);

  useEffect(() => {
    loadRequests().catch(() => {});
    const t = setInterval(() => loadRequests().catch(() => {}), 10_000);
    return () => clearInterval(t);
  }, [loadRequests]);
  useEffect(() => {
    loadLeads().catch(() => {});
  }, [loadLeads]);

  const setFilter = (key: keyof typeof filters, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setLimit(PAGE);
    setSelected(new Set());
  };

  async function updateLead(id: string, patch: Record<string, string>) {
    await api(`/api/admin/leads/${id}`, { method: "PATCH", body: patch });
    await loadLeads();
  }
  async function updateRequest(id: string, patch: Record<string, string>) {
    await api(`/api/admin/requests/${id}`, { method: "PATCH", body: patch });
    await loadRequests();
  }
  async function revealPhone(id: string): Promise<string> {
    if (phones[id]) return phones[id];
    const d = await api<{ phone: string }>(`/api/admin/leads/${id}`, { method: "PATCH", body: { action: "reveal_phone" } });
    setPhones((p) => ({ ...p, [id]: d.phone }));
    return d.phone;
  }
  /** Dials the number when there is one, and records the call either way. */
  async function call(l: ScoredLead) {
    if (l.phoneMasked) window.location.href = `tel:+91${await revealPhone(l.id)}`;
    if (!l.action || l.action.status === "to_call") await updateLead(l.id, { status: "called" });
  }
  async function assignSelected() {
    await Promise.all([...selected].map((id) => api(`/api/admin/leads/${id}`, { method: "PATCH", body: { assignedTo: bulkTo } })));
    setSelected(new Set());
    await loadLeads();
  }
  async function saveLead() {
    if (!draft) return;
    setFormError("");
    try {
      await api("/api/admin/leads", {
        method: "POST",
        body: { ...draft, employees: Number(draft.employees), sites: Number(draft.sites), telecomSpend: Number(draft.telecomSpend) || 0 },
      });
      setDraft(null);
      await loadLeads();
    } catch (e) {
      setFormError((e as Error).message);
    }
  }
  async function deleteLead(l: ScoredLead) {
    setMenu(null);
    const what = l.added ? "It will be removed for good." : "It is hidden from this list; the quarter's data file is not changed.";
    if (!confirm(`Delete the lead for ${l.businessName}? ${what}`)) return;
    await api(`/api/admin/leads/${l.id}`, { method: "DELETE" });
    setSelected((s) => {
      const n = new Set(s);
      n.delete(l.id);
      return n;
    });
    await loadLeads();
  }
  const setField = <K extends keyof LeadDraft>(k: K, v: LeadDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const openRequests = requests.filter((r) => r.status !== "resolved").length;
  const m = data?.model;
  const leads = data?.leads ?? [];
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));

  return (
    <section>
      <div className="ad-head">
        <div>
          <h1>Leads &amp; requests</h1>
          <p>Leads that dropped out last quarter, plus any your team adds.</p>
        </div>
        <button
          className="ad-btn ad-btn-primary"
          onClick={() => {
            setTab("leads");
            setFormError("");
            setDraft({ ...EMPTY_LEAD });
          }}
        >
          <Icon name="plus" /> Add lead
        </button>
      </div>

      <div className="ad-tabs">
        <button className={tab === "leads" ? "on" : ""} onClick={() => setTab("leads")}>
          Leads to call back {data && <span className="ad-count">{count(data.total)}</span>}
        </button>
        <button className={tab === "requests" ? "on" : ""} onClick={() => setTab("requests")}>
          Help requests {openRequests > 0 && <span className="ad-count ad-count-amber">{openRequests}</span>}
        </button>
      </div>

      {tab === "leads" && openRequests > 0 && (
        <div className="ad-alert">
          <Icon name="clock" />
          <p>
            <b>
              {openRequests} {openRequests === 1 ? "customer is" : "customers are"} waiting on a help request.
            </b>{" "}
            They have already started signing up, so answer these before calling new leads.
          </p>
          <button className="ad-btn" onClick={() => setTab("requests")}>
            Open help requests
          </button>
        </div>
      )}

      {tab === "leads" && draft && data && (
        <div className="ad-card ad-form editor">
          <h3>New lead</h3>
          <div className="grid3">
            <label className="span2">
              Business name
              <input value={draft.businessName} onChange={(e) => setField("businessName", e.target.value)} autoFocus />
            </label>
            <label>
              Business type
              <Select value={draft.businessType} neutral={draft.businessType} onChange={(v) => setField("businessType", v)} options={[{ value: "", label: "Choose…" }, ...data.options.businessTypes]} />
            </label>
            <label>
              Contact name
              <input value={draft.contactName} onChange={(e) => setField("contactName", e.target.value)} />
            </label>
            <label>
              Mobile (optional)
              <input value={draft.phone} onChange={(e) => setField("phone", e.target.value)} inputMode="tel" placeholder="98765 43210" />
            </label>
            <label>
              City
              <input value={draft.city} onChange={(e) => setField("city", e.target.value)} list="lead-cities" />
              <datalist id="lead-cities">
                {data.facets.cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label>
              Preferred language
              <Select value={draft.language} neutral={draft.language} onChange={(v) => setField("language", v)} options={data.options.languages} />
            </label>
            <label>
              Came via
              <Select value={draft.source} neutral={draft.source} onChange={(v) => setField("source", v)} options={data.options.sources} />
            </label>
            <label>
              Current internet
              <Select value={draft.currentInternet} neutral={draft.currentInternet} onChange={(v) => setField("currentInternet", v)} options={data.options.internet} />
            </label>
            <label>
              Staff
              <input type="number" min={1} value={draft.employees} onChange={(e) => setField("employees", e.target.value)} />
            </label>
            <label>
              Sites
              <input type="number" min={1} value={draft.sites} onChange={(e) => setField("sites", e.target.value)} />
            </label>
            <label>
              Telecom spend (₹/month)
              <input type="number" min={0} value={draft.telecomSpend} onChange={(e) => setField("telecomSpend", e.target.value)} />
            </label>
            <label>
              Turnover
              <Select value={draft.turnover} neutral={draft.turnover} onChange={(v) => setField("turnover", v)} options={data.options.turnover} />
            </label>
            <label className="toggle">
              <input type="checkbox" checked={draft.hasGstin} onChange={(e) => setField("hasGstin", e.target.checked)} />
              Has GSTIN
            </label>
            <label className="toggle">
              <input type="checkbox" checked={draft.hasUdyam} onChange={(e) => setField("hasUdyam", e.target.checked)} />
              Has Udyam registration
            </label>
            <label className="span3">
              Note (what they need, when to call)
              <input value={draft.note} onChange={(e) => setField("note", e.target.value)} />
            </label>
          </div>
          {formError && <p className="small fail">{formError}</p>}
          <div className="row">
            <button className="ad-btn ad-btn-primary" onClick={saveLead}>
              Save lead
            </button>
            <button className="ad-btn" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {tab === "leads" && data && (
        <>
          <div className="ad-card ad-strip">
            <div>
              <b>How leads are ranked</b>
              <p>
                A model trained on {count(data.model.trainedOn)} of last quarter&apos;s leads predicts each lead&apos;s chance to
                activate. Start from the top.
              </p>
            </div>
            <div>
              <strong>{m?.holdoutAuc.toFixed(2)}</strong>
              <p>AUC on leads it hasn&apos;t seen</p>
            </div>
            <div>
              <strong>{pct(m?.baseRate ?? 0)}</strong>
              <p>of all leads activate</p>
            </div>
            <div>
              <b>Expected value</b>
              <p>chance to convert × typical monthly bundle for the segment</p>
            </div>
          </div>

          <div className="ad-card ad-table-card">
            <div className="ad-filters">
              {(
                [
                  ["segment", "Segment", "All segments", data.facets.segments],
                  ["city", "City", "All cities", data.facets.cities],
                  ["stage", "Dropped at", "Any stage", data.facets.stages],
                ] as const
              ).map(([key, label, all, opts]) => (
                <label key={key}>
                  {label}
                  <Select value={filters[key]} onChange={(v) => setFilter(key, v)} options={[{ value: "", label: all }, ...opts]} />
                </label>
              ))}
              <label>
                Status
                <Select
                  value={filters.status}
                  neutral="open"
                  onChange={(v) => setFilter("status", v)}
                  options={[{ value: "open", label: "Not yet handled" }, { value: "", label: "Everything" }, ...LEAD_STATUS_OPTIONS]}
                />
              </label>
              <label>
                Sort by
                <Select
                  value={filters.sort}
                  neutral="probability"
                  onChange={(v) => setFilter("sort", v)}
                  options={[
                    { value: "probability", label: "Chance to convert" },
                    { value: "value", label: "Expected value" },
                  ]}
                />
              </label>
              <span className="ad-note ad-push">{count(data.total)} leads match</span>
            </div>

            {selected.size > 0 && (
              <div className="ad-bulk">
                <b>
                  {selected.size} {selected.size === 1 ? "lead" : "leads"} selected
                </b>
                <span>Assign to</span>
                <Select dark value={bulkTo} neutral={null} label="Assign to" onChange={setBulkTo} options={PARTNERS} />
                <button className="ad-btn ad-btn-light" onClick={assignSelected}>
                  Assign
                </button>
                <button className="ad-bulk-clear" onClick={() => setSelected(new Set())}>
                  Clear selection
                </button>
              </div>
            )}

            <table className="ad-table ad-leads">
              <thead>
                <tr>
                  <th className="ad-check">
                    <input
                      type="checkbox"
                      aria-label="Select all shown leads"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)))}
                    />
                  </th>
                  <th>Chance</th>
                  <th>Business</th>
                  <th>Dropped at</th>
                  <th>Why it ranks high</th>
                  <th className="num">Exp. value</th>
                  <th>Owner &amp; outcome</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className={selected.has(l.id) ? "sel" : ""}>
                    <td className="ad-check">
                      <input type="checkbox" aria-label={`Select ${l.businessName}`} checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
                    </td>
                    <td>
                      <strong className="ad-chance">{pct(l.probability)}</strong>
                      <div className="ad-meter">
                        <i style={{ width: `${Math.min(100, (l.probability / 0.5) * 100)}%` }} />
                      </div>
                      {m && <span className="ad-avg">{(l.probability / m.baseRate).toFixed(1)}× average</span>}
                    </td>
                    <td>
                      <b>{l.businessName}</b> {l.added && <span className="ad-pill st-active">Added</span>}
                      <div className="ad-muted">
                        {l.businessType} · {l.city}
                      </div>
                      <div className="ad-person">
                        <span className="ad-tag">{l.language}</span>
                        <Icon name="user" size={13} /> {l.contactName}
                        {l.phoneMasked && <span className="ad-muted"> · {phones[l.id] ?? l.phoneMasked}</span>}
                      </div>
                    </td>
                    <td>
                      <span className="ad-pill ad-pill-grey">{l.stageReached}</span>
                      <div className="ad-muted">{l.dropReason}</div>
                    </td>
                    <td>
                      <div className="ad-why">
                        {l.reasons.length ? (
                          l.reasons.map((r) => (
                            <span key={r}>
                              <Icon name="check" size={11} /> {r}
                            </span>
                          ))
                        ) : (
                          <em className="ad-muted">—</em>
                        )}
                      </div>
                    </td>
                    <td className="num">
                      <b>{formatInr(l.expectedMonthly)}</b>
                      <div className="ad-muted">per month</div>
                    </td>
                    <td>
                      <div className="ad-owner">
                        <Select
                          value={l.action?.assignedTo ?? ""}
                          label="Owner"
                          onChange={(v) => updateLead(l.id, { assignedTo: v })}
                          options={PARTNER_OPTIONS}
                        />
                        <Select
                          value={l.action?.status ?? "to_call"}
                          neutral="to_call"
                          label="Outcome"
                          onChange={(v) => updateLead(l.id, { status: v })}
                          options={LEAD_STATUS_OPTIONS}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="ad-row-actions">
                        <button
                          className="ad-btn"
                          onClick={() => call(l)}
                          title={l.phoneMasked ? `Call ${phones[l.id] ?? l.phoneMasked}` : "No number on file: logs the call"}
                        >
                          <Icon name="phone" /> Call
                        </button>
                        <div className="ad-menu">
                          <button className="ad-icon-btn" aria-label="More actions" onClick={() => setMenu(menu === l.id ? null : l.id)}>
                            <Icon name="dots" />
                          </button>
                          {menu === l.id && (
                            <div className="ad-menu-list" role="menu">
                              {l.phoneMasked && !phones[l.id] && (
                                <button role="menuitem" onClick={() => (setMenu(null), revealPhone(l.id))}>
                                  Show number
                                </button>
                              )}
                              <button role="menuitem" className="danger" onClick={() => deleteLead(l)}>
                                Delete lead
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {!leads.length && (
                  <tr>
                    <td colSpan={8} className="ad-empty">
                      No leads match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {leads.length > 0 && (
              <div className="ad-table-foot">
                <span>
                  Showing the top {count(leads.length)} of {count(data.total)} ·{" "}
                  {filters.sort === "value" ? "highest expected value first" : "highest chance first"}
                </span>
                {data.total > leads.length && (
                  <button className="ad-btn" onClick={() => setLimit((n) => n + PAGE)}>
                    Load next {Math.min(PAGE, data.total - leads.length)}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "requests" && (
        <div className="ad-card ad-table-card">
          <div className="ad-table-head">
            <div>
              <b>Help requests</b> <span className="ad-note">Owners who got stuck in the app and asked a partner to call them.</span>
            </div>
          </div>
          <table className="ad-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Why they need help</th>
                <th>Assigned to</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="ad-muted">
                    {new Date(r.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </td>
                  <td>
                    <b>{r.contact.name}</b>
                    <div className="ad-muted">
                      {phones[r.id] ?? r.contact.phone}{" "}
                      {!phones[r.id] && (
                        <button
                          className="linkbtn"
                          onClick={async () => {
                            const d = await api<{ phone: string }>(`/api/admin/requests/${r.id}`, {
                              method: "PATCH",
                              body: { action: "reveal_phone" },
                            });
                            setPhones((p) => ({ ...p, [r.id]: d.phone }));
                          }}
                        >
                          show
                        </button>
                      )}
                    </div>
                    <div className="ad-muted">
                      {[r.business.tradeName, r.business.businessType, r.business.city].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td>
                    {r.reasons.length ? r.reasons.map((x, i) => <div key={i}>• {x}</div>) : <span className="ad-muted">Asked for a call</span>}
                  </td>
                  <td>
                    <Select
                      value={r.assignedTo ?? ""}
                      label="Assigned to"
                      onChange={(v) => updateRequest(r.id, { assignedTo: v, status: "assigned" })}
                      options={PARTNER_OPTIONS}
                    />
                  </td>
                  <td>
                    <Select
                      value={r.status}
                      neutral="new"
                      label="Status"
                      onChange={(v) => updateRequest(r.id, { status: v })}
                      options={(Object.keys(REQ_STATUS) as RequestStatus[]).map((s) => ({ value: s, label: REQ_STATUS[s] }))}
                    />
                  </td>
                </tr>
              ))}
              {!requests.length && (
                <tr>
                  <td colSpan={5} className="ad-empty">
                    No help requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
