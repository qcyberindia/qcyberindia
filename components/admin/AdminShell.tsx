"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, RefreshCw, LogOut, LayoutDashboard, Building2, Landmark } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/qbids", label: "Qbids", icon: Building2 },
  { href: "/admin/qfinance", label: "QFinance", icon: Landmark },
];

const inputBase =
  "w-full rounded-md border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-fog)]/60 outline-none transition-colors focus:border-[var(--color-navy)] focus:ring-2 focus:ring-[var(--color-navy)]/10";

/**
 * Shared shell for every /admin page: one login gate, one nav, one theme —
 * and that theme is QCyberIndia's actual brand (navy/red/gold on warm
 * paper), not a borrowed product palette. Auth check happens via a plain
 * (non-async-function) fetch().then() chain inside the mount effect —
 * nothing runs synchronously before the effect returns, so this doesn't
 * trip react-hooks/set-state-in-effect.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/admin/session")
      .then((res) => setAuthed(res.ok))
      .catch(() => setAuthed(false))
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!json.ok) {
        setLoginError(json.error || "Login failed");
        return;
      }
      setPassword("");
      setAuthed(true);
    } catch {
      setLoginError("Login failed");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setAuthed(false);
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)]">
        <div className="flex items-center gap-2.5 text-sm text-[var(--color-fog)]">
          <RefreshCw size={15} className="animate-spin text-[var(--color-navy)]" />
          Loading…
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)] px-6 text-[var(--color-ink)]">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm space-y-6 rounded-2xl border border-[var(--color-line)] bg-white p-8 shadow-[var(--shadow-card)]"
        >
          <div className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-navy)]/20 bg-[var(--color-navy)]/5">
              <Lock size={18} className="text-[var(--color-navy)]" />
            </div>
            <p className="mt-4 font-display font-semibold tracking-tight text-[var(--color-navy)]">
              QCyberIndia Admin
            </p>
            <p className="mt-1 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fog)]">
              Qbids &amp; QFinance registrations
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-password" className="text-xs font-medium uppercase tracking-wide text-[var(--color-fog)]">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputBase}
            />
          </div>

          {loginError && (
            <p className="rounded-md border border-[var(--color-red)]/30 bg-[var(--color-red)]/5 px-3 py-2 text-sm text-[var(--color-red-deep)]">
              {loginError}
            </p>
          )}

          <button type="submit" disabled={loggingIn} className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
            {loggingIn && <RefreshCw size={14} className="mr-2 animate-spin" />}
            {loggingIn ? "Checking…" : "Log in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)]">
      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-[var(--color-line)] bg-white p-5 sm:block">
          <p className="font-display font-semibold tracking-tight text-[var(--color-navy)]">
            QCyber<span className="text-[var(--color-red)]">India</span>
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-fog)]">Admin</p>

          <nav className="mt-8 space-y-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-navy)]/[0.07] text-[var(--color-navy)]"
                      : "text-[var(--color-fog)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
                  }`}
                >
                  <Icon size={15} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={handleLogout}
            className="mt-8 flex items-center gap-1.5 text-sm text-[var(--color-fog)] transition-colors hover:text-[var(--color-red)]"
          >
            <LogOut size={14} />
            Log out
          </button>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
