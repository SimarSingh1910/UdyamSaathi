"use client";

import { useCallback, useEffect, useState } from "react";
import { formatInr } from "@/lib/i18n";
import type { ScoredLead } from "@/lib/leads";
import type { HelpRequest, LeadActionStatus, RequestStatus } from "@/lib/store";
import { api } from "./AdminShell";

interface LeadsResponse {
  total: number;
  leads: ScoredLead[];
  model: { holdoutAuc: number; baseRate: number; trainedOn: number };
  facets: { segments: string[]; cities: string[]; stages: string[] };
}

const LEAD_STATUS: Record<LeadActionStatus, string> = {
  to_call: "To call",
  called: "Called",
  won: "Won",
  not_interested: "Not interested",
};
const REQ_STATUS: Record<RequestStatus, string> = { new: "New", assigned: "Assigned", contacted: "Contacted", resolved: "Resolved" };
const PARTNERS = ["Field sales: North", "Field sales: West", "Partner: Sharma Telecom", "Partner: Digital Dukaan", "Inside sales"];

const pct = (p: number) => `${Math.round(p * 100)}%`;

export default function LeadsAdmin() {
  const [tab, setTab] = useState<"requests" | "leads">("requests");
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [filters, setFilters] = useState({ segment: "", city: "", stage: "", status: "open", sort: "probability" });
  const [phones, setPhones] = useState<Record<string, string>>({});

  const loadRequests = useCallback(
    () => api<{ requests: HelpRequest[] }>("/api/admin/requests").then((d) => setRequests(d.requests)),
    [],
  );
  const loadLeads = useCallback(() => {
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    q.set("limit", "50");
    return api<LeadsResponse>(`/api/admin/leads?${q}`).then(setData);
  }, [filters]);

  useEffect(() => {
    loadRequests().catch(() => {});
    const t = setInterval(() => loadRequests().catch(() => {}), 10_000);
    return () => clearInterval(t);
  }, [loadRequests]);
  useEffect(() => {
    loadLeads().catch(() => {});
  }, [loadLeads]);

  async function updateLead(id: string, patch: Record<string, string>) {
    await api(`/api/admin/leads/${id}`, { method: "PATCH", body: patch });
    await loadLeads();
  }
  async function updateRequest(id: string, patch: Record<string, string>) {
    await api(`/api/admin/requests/${id}`, { method: "PATCH", body: patch });
    await loadRequests();
  }

  const openRequests = requests.filter((r) => r.status !== "resolved").length;
  const m = data?.model;

  return (
    <section>
      <div className="row toolbar">
        <div className="chips">
          <button className={`chip${tab === "requests" ? " chip-on" : ""}`} onClick={() => setTab("requests")}>
            Help requests ({openRequests})
          </button>
          <button className={`chip${tab === "leads" ? " chip-on" : ""}`} onClick={() => setTab("leads")}>
            Leads to call back {data ? `(${data.total})` : ""}
          </button>
        </div>
      </div>

      {tab === "requests" && (
        <>
          <p className="muted small">Owners who got stuck in the app and asked a partner to call them.</p>
          <table className="table">
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
                  <td className="small muted">{new Date(r.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                  <td>
                    <b>{r.contact.name}</b> · {phones[r.id] ?? r.contact.phone}{" "}
                    {!phones[r.id] && (
                      <button
                        className="linkbtn small"
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
                    <div className="muted small">
                      {[r.business.tradeName, r.business.businessType, r.business.city].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="small">
                    {r.reasons.length ? r.reasons.map((x, i) => <div key={i}>• {x}</div>) : "Asked for a call"}
                  </td>
                  <td>
                    <select value={r.assignedTo ?? ""} onChange={(e) => updateRequest(r.id, { assignedTo: e.target.value, status: "assigned" })}>
                      <option value="">Unassigned</option>
                      {PARTNERS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={r.status} onChange={(e) => updateRequest(r.id, { status: e.target.value })}>
                      {(Object.keys(REQ_STATUS) as RequestStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {REQ_STATUS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {!requests.length && (
                <tr>
                  <td colSpan={5} className="muted">
                    No help requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}

      {tab === "leads" && data && (
        <>
          <div className="card model-card small">
            <b>How leads are ranked.</b> A model trained on {data.model.trainedOn.toLocaleString("en-IN")} of the quarter&apos;s
            leads predicts how likely each one is to activate. On leads it has not seen it scores an AUC of{" "}
            <b>{m?.holdoutAuc.toFixed(2)}</b>. The average lead activates {pct(m?.baseRate ?? 0)} of the time, so start
            from the top. &quot;Value&quot; is the chance of converting × the typical monthly bundle for that segment.
          </div>

          <div className="row toolbar">
            {(
              [
                ["segment", "All segments", data.facets.segments],
                ["city", "All cities", data.facets.cities],
                ["stage", "Any stage", data.facets.stages],
              ] as const
            ).map(([key, label, opts]) => (
              <select key={key} value={filters[key]} onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}>
                <option value="">{label}</option>
                {opts.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ))}
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="open">Not yet handled</option>
              <option value="">Everything</option>
              {(Object.keys(LEAD_STATUS) as LeadActionStatus[]).map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS[s]}
                </option>
              ))}
            </select>
            <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
              <option value="probability">Sort by chance to convert</option>
              <option value="value">Sort by expected value</option>
            </select>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>Score</th>
                <th>Business</th>
                <th>Dropped at</th>
                <th>Why it scores well</th>
                <th>Value</th>
                <th>Assign</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {data.leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className="score" style={{ ["--p" as string]: Math.min(1, l.probability / 0.4) }}>
                      {pct(l.probability)}
                    </span>
                  </td>
                  <td>
                    <b>{l.businessName}</b>
                    <div className="muted small">
                      {l.businessType} · {l.city} · {l.language} · via {l.source.toLowerCase()} · {l.contactName}
                    </div>
                  </td>
                  <td className="small">
                    {l.stageReached}
                    <div className="muted">{l.dropReason}</div>
                  </td>
                  <td className="small">{l.reasons.join(", ") || "—"}</td>
                  <td>{formatInr(l.expectedMonthly)}</td>
                  <td>
                    <select value={l.action?.assignedTo ?? ""} onChange={(e) => updateLead(l.id, { assignedTo: e.target.value })}>
                      <option value="">—</option>
                      {PARTNERS.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select value={l.action?.status ?? "to_call"} onChange={(e) => updateLead(l.id, { status: e.target.value })}>
                      {(Object.keys(LEAD_STATUS) as LeadActionStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {LEAD_STATUS[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
