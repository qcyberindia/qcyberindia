"use client";

import { useEffect, useMemo, useState } from "react";
import {
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
import AdminLoadingState from "@/components/admin/AdminLoadingState";

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

// Light-theme status palette. These are semantic status colors, not the
// QCyberIndia brand palette itself — brand navy/red/gold are reserved for
// structural/interactive elements (nav, buttons, links) so a "declined"
// pill doesn't visually compete with a primary CTA.
const STATUS_META: Record<
  (typeof STATUSES)[number],
  { label: string; icon: typeof Inbox; color: string; ring: string; dot: string }
> = {
  new: { label: "New", icon: Inbox, color: "text-blue-700", ring: "border-blue-200 bg-blue-50", dot: "bg-blue-500" },
  reviewed: { label: "Reviewed", icon: Eye, color: "text-amber-700", ring: "border-amber-200 bg-amber-50", dot: "bg-amber-500" },
  qualified: { label: "Qualified", icon: CheckCircle2, color: "text-indigo-700", ring: "border-indigo-200 bg-indigo-50", dot: "bg-indigo-500" },
  invited: { label: "Invited", icon: Send, color: "text-purple-700", ring: "border-purple-200 bg-purple-50", dot: "bg-purple-500" },
  active: { label: "Active", icon: Zap, color: "text-emerald-700", ring: "border-emerald-200 bg-emerald-50", dot: "bg-emerald-500" },
  declined: { label: "Declined", icon: XCircle, color: "text-red-700", ring: "border-red-200 bg-red-50", dot: "bg-red-500" },
};

const inputBase =
  "w-full rounded-md border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[var(--color-ink)] placeholder:text-[var(--color-fog)]/60 outline-none transition-colors focus:border-[var(--color-navy)] focus:ring-2 focus:ring-[var(--color-navy)]/10";

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function AdminQbidsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  function load() {
    fetch("/api/qbids/admin/registrations")
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok) {
          setLoadError(json.error || "Failed to load registrations");
          return;
        }
        setLoadError("");
        setRegistrations(json.registrations);
        setLastUpdated(new Date());
      })
      .catch(() => setLoadError("Failed to load registrations"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

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
        !q || r.name.toLowerCase().includes(q) || r.company.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [registrations, search, statusFilter]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-red)]">Qbids</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Beta Registrations
          </h1>
        </div>
        {lastUpdated && (
          <p className="text-[11px] text-[var(--color-fog)]">
            Updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

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
                  ? "border-[var(--color-navy)] bg-[var(--color-navy)]/[0.05]"
                  : "border-[var(--color-line)] bg-white hover:border-[var(--color-navy)]/30"
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${meta.ring}`}>
                <Icon size={15} className={meta.color} />
              </div>
              <p className="mt-3 font-display text-2xl font-bold tabular-nums text-[var(--color-ink)]">{counts[s] ?? 0}</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-fog)]">{meta.label}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[220px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fog)]" />
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
            className="flex items-center gap-1 rounded-full border border-[var(--color-line)] px-3 py-1 text-xs text-[var(--color-fog)] transition-colors hover:border-[var(--color-navy)]/40 hover:text-[var(--color-ink)]"
          >
            {STATUS_META[statusFilter as keyof typeof STATUS_META]?.label}
            <X size={12} />
          </button>
        )}
        <button
          onClick={() => {
            setLoading(true);
            load();
          }}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3.5 py-1.5 text-sm text-[var(--color-fog)] transition-colors hover:border-[var(--color-navy)]/40 hover:text-[var(--color-ink)] disabled:opacity-60"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loadError && (
        <p className="mt-4 rounded-md border border-[var(--color-red)]/30 bg-[var(--color-red)]/5 px-3 py-2 text-sm text-[var(--color-red-deep)]">
          {loadError}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--color-line)] bg-white">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-paper-2)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-fog)]">
              <th scope="col" className="px-4 py-3 font-medium">Contact</th>
              <th scope="col" className="px-4 py-3 font-medium">Company</th>
              <th scope="col" className="px-4 py-3 font-medium">Portals</th>
              <th scope="col" className="px-4 py-3 font-medium">Registered</th>
              <th scope="col" className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && registrations.length === 0 && (
              <tr><td colSpan={5}><AdminLoadingState /></td></tr>
            )}
            {filtered.map((r) => {
              const meta = STATUS_META[r.status as keyof typeof STATUS_META];
              return (
                <tr key={r.id} className="border-b border-[var(--color-line)] transition-colors last:border-0 hover:bg-[var(--color-paper-2)]/60">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-line)] bg-[var(--color-paper-2)] text-[11px] font-semibold text-[var(--color-navy)]">
                        {initials(r.name) || "—"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--color-ink)]">{r.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--color-fog)]">
                          <a href={`mailto:${r.email}`} className="flex items-center gap-1 hover:text-[var(--color-navy)]">
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
                  <td className="px-4 py-3.5 text-[var(--color-fog)]">{r.company}</td>
                  <td className="px-4 py-3.5">
                    {r.portals?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {r.portals.map((p) => (
                          <span key={p} className="rounded-full border border-[var(--color-line)] bg-[var(--color-paper-2)] px-2 py-0.5 text-xs text-[var(--color-fog)]">
                            {p}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[var(--color-fog)]/60">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-fog)]">
                    {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="relative inline-flex items-center">
                      <span className={`pointer-events-none absolute left-2.5 h-1.5 w-1.5 rounded-full ${meta?.dot ?? "bg-[var(--color-fog)]"}`} />
                      <select
                        value={r.status}
                        onChange={(e) => handleStatusChange(r.id, e.target.value)}
                        aria-label={`Change status for ${r.name}`}
                        className={`appearance-none rounded-full border py-1 pl-6 pr-6 text-[11px] font-semibold uppercase tracking-wide outline-none transition-colors ${
                          meta?.ring ?? "border-[var(--color-line)] bg-white"
                        } ${meta?.color ?? "text-[var(--color-fog)]"}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s} className="bg-white text-[var(--color-ink)]">
                            {STATUS_META[s].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-[var(--color-fog)]">
                  <Inbox size={22} className="mx-auto mb-2 text-[var(--color-line)]" />
                  No registrations {statusFilter !== "all" || search ? "match this filter" : "yet"}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {registrations.length > 0 && (
        <p className="mt-3 text-[11px] text-[var(--color-fog)]">
          {filtered.length} of {registrations.length} registrations shown.
        </p>
      )}

      {filtered.some((r) => r.challenge) && (
        <div className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-fog)]">Reported bidding challenges</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {filtered
              .filter((r) => r.challenge)
              .map((r) => (
                <div key={r.id} className="rounded-xl border border-[var(--color-line)] bg-white p-4">
                  <div className="flex items-start gap-2.5">
                    <MessageSquareQuote size={15} className="mt-0.5 shrink-0 text-[var(--color-navy)]" />
                    <div className="min-w-0">
                      <p className="text-sm leading-relaxed text-[var(--color-ink)]">{r.challenge}</p>
                      <p className="mt-2 text-xs text-[var(--color-fog)]">
                        {r.name} — {r.company}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
