"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Lock,
  LogOut,
  RefreshCw,
  Search,
  X,
  Inbox,
  Eye,
  CheckCircle2,
  Send,
  Zap,
  XCircle,
  MessageSquareQuote,
  Mail,
  Phone,
} from "lucide-react";

type Registration = {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  portals: string[];
  challenge: string | null;
  status: string;
  created_at: string;
};

const STATUSES = ["new", "reviewed", "qualified", "invited", "active", "declined"] as const;

const STATUS_META: Record<
  (typeof STATUSES)[number],
  { label: string; icon: typeof Inbox; color: string; ring: string; dot: string }
> = {
  new: { label: "New", icon: Inbox, color: "text-[#3fd0c9]", ring: "border-[#3fd0c9]/30 bg-[#3fd0c9]/10", dot: "bg-[#3fd0c9]" },
  reviewed: { label: "Reviewed", icon: Eye, color: "text-amber-300", ring: "border-amber-500/30 bg-amber-500/10", dot: "bg-amber-400" },
  qualified: { label: "Qualified", icon: CheckCircle2, color: "text-blue-300", ring: "border-blue-500/30 bg-blue-500/10", dot: "bg-blue-400" },
  invited: { label: "Invited", icon: Send, color: "text-purple-300", ring: "border-purple-500/30 bg-purple-500/10", dot: "bg-purple-400" },
  active: { label: "Active", icon: Zap, color: "text-emerald-300", ring: "border-emerald-500/30 bg-emerald-500/10", dot: "bg-emerald-400" },
  declined: { label: "Declined", icon: XCircle, color: "text-red-300", ring: "border-red-500/30 bg-red-500/10", dot: "bg-red-400" },
};

const inputBase =
  "w-full rounded-md border border-[#1e2a38] bg-[#111823] px-3.5 py-2.5 text-[#e6edf3] placeholder:text-[#8aa0b4]/60 outline-none transition-colors focus:border-[#3fd0c9] focus:ring-2 focus:ring-[#3fd0c9]/15";

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function QbidsAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadRegistrations = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/qbids/admin/registrations");
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const json = await res.json();
      if (!json.ok) {
        setLoadError(json.error || "Failed to load registrations");
        return;
      }
      setRegistrations(json.registrations);
      setAuthed(true);
      setLastUpdated(new Date());
    } catch {
      setLoadError("Failed to load registrations");
    } finally {
      setLoading(false);
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/qbids/admin/auth", {
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
      await loadRegistrations();
    } catch {
      setLoginError("Login failed");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/qbids/admin/auth", { method: "DELETE" });
    setAuthed(false);
    setRegistrations([]);
  }

  async function handleStatusChange(id: number, status: string) {
    const prev = registrations;
    setRegistrations((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
    const res = await fetch("/api/qbids/admin/registrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) setRegistrations(prev);
  }

  const counts = useMemo(
    () =>
      STATUSES.reduce<Record<string, number>>((acc, s) => {
        acc[s] = registrations.filter((r) => r.status === s).length;
        return acc;
      }, {}),
    [registrations]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registrations.filter((r) => {
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [registrations, search, statusFilter]);

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c1016]">
        <div className="flex items-center gap-2.5 text-sm text-[#8aa0b4]">
          <RefreshCw size={15} className="animate-spin text-[#3fd0c9]" />
          Loading…
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0c1016] px-6 text-[#e6edf3]">
        <div className="network-grid on-dark" />
        <form
          onSubmit={handleLogin}
          className="relative w-full max-w-sm space-y-6 rounded-2xl border border-[#1e2a38] bg-[#111823]/90 p-8 shadow-[0_1px_2px_rgba(0,0,0,0.2),0_24px_48px_-24px_rgba(63,208,201,0.18)] backdrop-blur"
        >
          <div className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#3fd0c9]/30 bg-[#3fd0c9]/10">
              <Lock size={18} className="text-[#3fd0c9]" />
            </div>
            <p className="mt-4 font-display font-semibold tracking-tight">
              Q<span className="text-[#3fd0c9]">bids</span> Admin
            </p>
            <p className="mt-1 font-display text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8aa0b4]">
              Beta registrations dashboard
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-password" className="text-xs font-medium uppercase tracking-wide text-[#8aa0b4]">
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
            <p className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {loginError}
            </p>
          )}

          <button
            type="submit"
            disabled={loggingIn}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[#3fd0c9] px-4 py-2.5 font-semibold text-[#0c1016] transition-colors hover:bg-[#22968f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingIn && <RefreshCw size={14} className="animate-spin" />}
            {loggingIn ? "Checking…" : "Log in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1016] text-[#e6edf3]">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-[#1e2a38]">
        <div className="network-grid on-dark opacity-60" />
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <span className="font-display font-semibold tracking-tight">
              Q<span className="text-[#3fd0c9]">bids</span> Admin
            </span>
            <p className="mt-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8aa0b4]">
              Beta recruitment workflow
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-md border border-[#1e2a38] px-3.5 py-1.5 text-sm text-[#8aa0b4] transition-colors hover:border-red-500/40 hover:text-red-300"
          >
            <LogOut size={14} />
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-[#3fd0c9]">Pipeline</p>
            <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Beta Registrations
            </h1>
          </div>
          {lastUpdated && (
            <p className="font-display text-[11px] text-[#8aa0b4]">
              Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>

        {/* Status summary */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUSES.map((s) => {
            const meta = STATUS_META[s];
            const Icon = meta.icon;
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(active ? "all" : s)}
                className={`group rounded-xl border p-4 text-left transition-all ${
                  active
                    ? "border-[#3fd0c9] bg-[#3fd0c9]/10 shadow-[0_8px_20px_-12px_rgba(63,208,201,0.5)]"
                    : "border-[#1e2a38] bg-[#111823] hover:border-[#3fd0c9]/30"
                }`}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${meta.ring}`}>
                  <Icon size={15} className={meta.color} />
                </div>
                <p className="mt-3 font-display text-2xl font-bold tabular-nums">{counts[s] ?? 0}</p>
                <p className="mt-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8aa0b4]">
                  {meta.label}
                </p>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1 min-w-[220px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8aa0b4]" />
            <input
              type="text"
              placeholder="Search name, company, email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputBase} pl-9`}
            />
          </div>
          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className="flex items-center gap-1 rounded-full border border-[#1e2a38] px-3 py-1 text-xs text-[#8aa0b4] transition-colors hover:border-[#3fd0c9]/40 hover:text-[#e6edf3]"
            >
              {STATUS_META[statusFilter as keyof typeof STATUS_META]?.label}
              <X size={12} />
            </button>
          )}
          <button
            onClick={loadRegistrations}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 rounded-md border border-[#1e2a38] px-3.5 py-1.5 text-sm text-[#8aa0b4] transition-colors hover:border-[#3fd0c9]/50 hover:text-[#e6edf3] disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {loadError && (
          <p className="mt-4 rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {loadError}
          </p>
        )}

        {/* Table */}
        <div className="mt-6 overflow-x-auto rounded-xl border border-[#1e2a38] bg-[#0a0e13]">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e2a38] bg-[#111823] font-display text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8aa0b4]">
                <th scope="col" className="px-4 py-3 font-medium">Contact</th>
                <th scope="col" className="px-4 py-3 font-medium">Company</th>
                <th scope="col" className="px-4 py-3 font-medium">Portals</th>
                <th scope="col" className="px-4 py-3 font-medium">Registered</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && registrations.length === 0 &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b border-[#1e2a38] last:border-0">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-[#1e2a38]" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-28 animate-pulse rounded bg-[#1e2a38]" />
                          <div className="h-2.5 w-36 animate-pulse rounded bg-[#1e2a38]" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><div className="h-3 w-20 animate-pulse rounded bg-[#1e2a38]" /></td>
                    <td className="px-4 py-3.5"><div className="h-5 w-16 animate-pulse rounded-full bg-[#1e2a38]" /></td>
                    <td className="px-4 py-3.5"><div className="h-3 w-16 animate-pulse rounded bg-[#1e2a38]" /></td>
                    <td className="px-4 py-3.5"><div className="h-5 w-20 animate-pulse rounded-full bg-[#1e2a38]" /></td>
                  </tr>
                ))}
              {filtered.map((r) => {
                const meta = STATUS_META[r.status as keyof typeof STATUS_META];
                return (
                  <tr key={r.id} className="border-b border-[#1e2a38] transition-colors last:border-0 hover:bg-[#111823]/70">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#1e2a38] bg-[#111823] font-display text-[11px] font-semibold text-[#3fd0c9]">
                          {initials(r.name) || "—"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#e6edf3]">{r.name}</p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#8aa0b4]">
                            <a href={`mailto:${r.email}`} className="flex items-center gap-1 hover:text-[#3fd0c9]">
                              <Mail size={11} /> {r.email}
                            </a>
                            {r.phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={11} /> {r.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[#8aa0b4]">{r.company}</td>
                    <td className="px-4 py-3.5">
                      {r.portals?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {r.portals.map((p) => (
                            <span
                              key={p}
                              className="rounded-full border border-[#1e2a38] bg-[#111823] px-2 py-0.5 text-xs text-[#8aa0b4]"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#8aa0b4]/60">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[#8aa0b4]">
                      {new Date(r.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="relative inline-flex items-center">
                        <span className={`pointer-events-none absolute left-2.5 h-1.5 w-1.5 rounded-full ${meta?.dot ?? "bg-[#8aa0b4]"}`} />
                        <select
                          value={r.status}
                          onChange={(e) => handleStatusChange(r.id, e.target.value)}
                          aria-label={`Change status for ${r.name}`}
                          className={`appearance-none rounded-full border py-1 pl-6 pr-6 font-display text-[11px] font-semibold uppercase tracking-wide outline-none transition-colors ${
                            meta?.ring ?? "border-[#1e2a38] bg-[#0c1016]"
                          } ${meta?.color ?? "text-[#8aa0b4]"}`}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s} className="bg-[#111823] text-[#e6edf3]">
                              {STATUS_META[s].label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && registrations.length > 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-[#8aa0b4]">
                    <Inbox size={22} className="mx-auto mb-2 text-[#1e2a38]" />
                    No registrations {statusFilter !== "all" || search ? "match this filter" : "yet"}.
                  </td>
                </tr>
              )}
              {filtered.length === 0 && !loading && registrations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center text-[#8aa0b4]">
                    <Inbox size={22} className="mx-auto mb-2 text-[#1e2a38]" />
                    No registrations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {registrations.length > 0 && (
          <p className="mt-3 font-display text-[11px] text-[#8aa0b4]">
            {filtered.length} of {registrations.length} registrations shown.
          </p>
        )}

        {/* Challenge text */}
        {filtered.some((r) => r.challenge) && (
          <div className="mt-10">
            <h2 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#8aa0b4]">
              Reported bidding challenges
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {filtered
                .filter((r) => r.challenge)
                .map((r) => (
                  <div key={r.id} className="rounded-xl border border-[#1e2a38] bg-[#111823] p-4">
                    <div className="flex items-start gap-2.5">
                      <MessageSquareQuote size={15} className="mt-0.5 shrink-0 text-[#3fd0c9]" />
                      <div className="min-w-0">
                        <p className="text-sm leading-relaxed text-[#e6edf3]">{r.challenge}</p>
                        <p className="mt-2 text-xs text-[#8aa0b4]">
                          {r.name} — {r.company}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
