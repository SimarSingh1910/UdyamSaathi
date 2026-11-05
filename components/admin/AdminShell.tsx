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
  { href: "/admin/leads", label: "Leads & requests" },
  { href: "/admin/services", label: "Services" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "in" | "out">("checking");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const path = usePathname();

  useEffect(() => {
    fetch("/api/admin/stats", { cache: "no-store" }).then((r) => setState(r.ok ? "in" : "out"));
    const out = () => setState("out");
    window.addEventListener("uds-admin-logout", out);
    return () => window.removeEventListener("uds-admin-logout", out);
  }, []);

  if (state === "checking") return <div className="admin" />;

  if (state === "out") {
    return (
      <div className="admin admin-login">
        <form
          className="card"
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
          <span className="badge">Accel Business</span>
          <h1>Back office</h1>
          <Link href="/" className="home-link">
            ← Demo home
          </Link>
          <p className="muted small">For Accel staff and partners only.</p>
          <label className="form">
            Passcode
            <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} autoFocus />
          </label>
          {error && <p className="small fail">{error}</p>}
          <button className="btn">Sign in</button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin">
      <header className="admin-bar">
        <Link href="/admin" className="brand">
          UdyamSaathi <span className="muted small">· Accel back office</span>
        </Link>
        <nav>
          <Link href="/" className="home-link">
            ← Demo home
          </Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href ? "on" : ""}>
              {n.label}
            </Link>
          ))}
          <button
            className="btn btn-ghost btn-small"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              setState("out");
            }}
          >
            Sign out
          </button>
        </nav>
      </header>
      {children}
    </div>
  );
}
