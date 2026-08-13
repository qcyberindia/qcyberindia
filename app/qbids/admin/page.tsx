"use client";

import { useEffect, useState, useCallback } from "react";

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

const statusColor: Record<string, string> = {
  new: "bg-[#3fd0c9]/15 text-[#3fd0c9] border-[#3fd0c9]/30",
  reviewed: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  qualified: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  invited: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  declined: "bg-red-500/15 text-red-300 border-red-500/30",
};

const inputBase =
  "w-full rounded-md border border-[#1e2a38] bg-[#111823] px-3.5 py-2.5 text-[#e6edf3] outline-none transition-colors focus:border-[#3fd0c9] focus:ring-2 focus:ring-[#3fd0c9]/15";

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
    // Optimistic update
    setRegistrations((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const res = await fetch("/api/qbids/admin/registrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) {
      // Revert on failure
      loadRegistrations();
    }
  }

  const counts = STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = registrations.filter((r) => r.status === s).length;
    return acc;
  }, {});

  const filtered = registrations.filter((r) => {
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.name.toLowerCase().includes(q) ||
      r.company.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c1016] text-[#8aa0b4]">
        Loading…
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0c1016] px-6 text-[#e6edf3]">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm space-y-5 rounded-xl border border-[#1e2a38] bg-[#111823] p-8"
        >
          <div className="text-center">
            <p className="font-semibold tracking-tight">
              Q<span className="text-[#3fd0c9]">bids</span> Admin
            </p>
            <p className="mt-1 text-sm text-[#8aa0b4]">Beta registrations dashboard</p>
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
          {loginError && <p className="text-sm text-red-300">{loginError}</p>}
          <button
            type="submit"
            disabled={loggingIn}
            className="w-full rounded-md bg-[#3fd0c9] px-4 py-2.5 font-semibold text-[#0c1016] transition-colors hover:bg-[#22968f] disabled:opacity-60"
          >
            {loggingIn ? "Checking…" : "Log in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1016] text-[#e6edf3]">
      <header className="border-b border-[#1e2a38]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-semibold tracking-tight">
            Q<span className="text-[#3fd0c9]">bids</span> Admin
          </span>
          <button
            onClick={handleLogout}
            className="rounded-md border border-[#1e2a38] px-3.5 py-1.5 text-sm text-[#8aa0b4] transition-colors hover:border-red-500/40 hover:text-red-300"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Beta Registrations</h1>

        {/* Status summary */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                statusFilter === s ? "border-[#3fd0c9] bg-[#3fd0c9]/10" : "border-[#1e2a38] bg-[#111823]"
              }`}
            >
              <p className="text-2xl font-bold">{counts[s] ?? 0}</p>
              <p className="mt-0.5 text-xs capitalize text-[#8aa0b4]">{s}</p>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search name, company, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputBase} max-w-xs`}
          />
          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              className="rounded-full border border-[#1e2a38] px-3 py-1 text-xs text-[#8aa0b4] hover:text-[#e6edf3]"
            >
              Clear filter ({statusFilter}) ✕
            </button>
          )}
          <button
            onClick={loadRegistrations}
            className="ml-auto rounded-md border border-[#1e2a38] px-3.5 py-1.5 text-sm text-[#8aa0b4] transition-colors hover:border-[#3fd0c9]/50 hover:text-[#e6edf3]"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {loadError && (
          <p className="mt-4 rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {loadError}
          </p>
        )}

        {/* Table */}
        <div className="mt-6 overflow-x-auto rounded-xl border border-[#1e2a38]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#1e2a38] bg-[#111823] text-xs uppercase tracking-wide text-[#8aa0b4]">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Portals</th>
                <th className="px-4 py-3">Registered</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-[#1e2a38] last:border-0 hover:bg-[#111823]/60">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-[#8aa0b4]">{r.company}</td>
                  <td className="px-4 py-3 text-[#8aa0b4]">
                    <a href={`mailto:${r.email}`} className="hover:text-[#3fd0c9]">
                      {r.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-[#8aa0b4]">{r.phone}</td>
                  <td className="px-4 py-3 text-[#8aa0b4]">
                    {r.portals?.length ? r.portals.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[#8aa0b4]">
                    {new Date(r.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={r.status}
                      onChange={(e) => handleStatusChange(r.id, e.target.value)}
                      className={`rounded-full border px-2.5 py-1 text-xs capitalize outline-none ${
                        statusColor[r.status] ?? "border-[#1e2a38] bg-[#0c1016] text-[#8aa0b4]"
                      }`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-[#111823] text-[#e6edf3]">
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[#8aa0b4]">
                    No registrations {statusFilter !== "all" || search ? "match this filter" : "yet"}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {registrations.length > 0 && (
          <p className="mt-3 text-xs text-[#8aa0b4]">{registrations.length} total registrations.</p>
        )}

        {/* Challenge text, shown below the table since it's often long free text */}
        {filtered.some((r) => r.challenge) && (
          <div className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#8aa0b4]">
              Reported bidding challenges
            </h2>
            <div className="mt-3 space-y-3">
              {filtered
                .filter((r) => r.challenge)
                .map((r) => (
                  <div key={r.id} className="rounded-lg border border-[#1e2a38] bg-[#111823] p-4">
                    <p className="text-xs text-[#8aa0b4]">
                      {r.name} — {r.company}
                    </p>
                    <p className="mt-1.5 text-sm">{r.challenge}</p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
