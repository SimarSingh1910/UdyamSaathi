"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Fetch helper for back-office pages: JSON in/out, throws on errors. */
export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event("uds-admin-logout"));
    throw new Error("Signed out");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data as T;
}

const NAV = [
  { href: "/admin", label: "Orders" },
  { href: "/admin/leads", label: "Leads & requests", badge: true },
  { href: "/admin/services", label: "Services" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "in" | "out">("checking");
  const [openRequests, setOpenRequests] = useState(0);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const path = usePathname();

  useEffect(() => {
    // The stats call doubles as the sign-in check and feeds the help-request badge.
    const check = () =>
      fetch("/api/admin/stats", { cache: "no-store" })
        .then(async (r) => {
          setState(r.ok ? "in" : "out");
          if (r.ok) setOpenRequests((await r.json()).live?.openRequests ?? 0);
        })
        .catch(() => {});
    check();
    const t = setInterval(check, 15_000);
    const out = () => setState("out");
    window.addEventListener("uds-admin-logout", out);
    return () => {
      clearInterval(t);
      window.removeEventListener("uds-admin-logout", out);
    };
  }, []);

  if (state === "checking") return <div className="admin" />;

  if (state === "out") {
    return (
      <div className="admin admin-login">
        <form
          className="ad-card"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            const res = await fetch("/api/admin/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ passcode }),
            });
            if (res.ok) setState("in");
            else setError("Wrong passcode");
          }}
        >
          <span className="ad-brand">UdyamSaathi</span>
          <h1>Back office</h1>
          <p className="muted small">For Accel staff and partners only.</p>
          <label className="form">
            Passcode
            <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} autoFocus />
          </label>
          {error && <p className="small fail">{error}</p>}
          <button className="ad-btn ad-btn-primary">Sign in</button>
          <Link href="/" className="ad-quiet">
            ← Demo home
          </Link>
        </form>
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="ad-top">
        <div className="ad-wrap ad-top-row">
          <Link href="/admin" className="ad-brand">
            UdyamSaathi
          </Link>
          <span className="ad-sub">Accel back office</span>
          <nav className="ad-nav">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""}>
                {n.label}
                {n.badge && openRequests > 0 && <span className="ad-count ad-count-amber">{openRequests}</span>}
              </Link>
            ))}
          </nav>
          <Link href="/" className="ad-quiet ad-push">
            Demo home
          </Link>
          <button
            className="ad-btn"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              setState("out");
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="ad-wrap ad-main">{children}</div>
    </div>
  );
}
