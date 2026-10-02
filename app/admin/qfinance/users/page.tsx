"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import AdminEmptyState from "@/components/admin/AdminEmptyState";
import AdminLoadingState from "@/components/admin/AdminLoadingState";

type UserRow = {
  id: number;
  displayName: string;
  email: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  poolCount: number;
  activeSessions: number;
};

const date = (v: string | null) =>
  v ? new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function AdminQFineraUsersPage() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ users: UserRow[]; total: number; pageSize: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const qs = new URLSearchParams({ page: String(page) });
    if (applied) qs.set("q", applied);
    if (status) qs.set("status", status);
    let cancelled = false;
    fetch(`/api/admin/qfinance/users?${qs}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.ok) setError(j.error?.message ?? j.error ?? "Failed to load users");
        else {
          setError("");
          setData(j.data);
        }
      })
      .catch(() => !cancelled && setError("Failed to load users"));
    return () => {
      cancelled = true;
    };
  }, [applied, status, page]);

  return (
    <div>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-red)]">QFinera</p>
      <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">Users</h1>
      <p className="mt-2 max-w-xl text-sm text-[var(--color-fog)]">
        Registered QFinera accounts. Passwords are never visible here; use &ldquo;Send password reset&rdquo; on a user to help them back in.
      </p>

      <form
        className="mt-5 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setApplied(q.trim());
        }}
      >
        <label className="sr-only" htmlFor="user-search">Search users</label>
        <input id="user-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" className="min-w-[14rem] flex-1 rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm" />
        <label className="sr-only" htmlFor="user-status">Status</label>
        <select id="user-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <button type="submit" className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] bg-white px-3 py-2 text-sm">
          <Search size={14} /> Search
        </button>
      </form>

      {error && <p className="mt-4 rounded-md border border-[var(--color-red)]/30 bg-[var(--color-red)]/5 px-3 py-2 text-sm text-[var(--color-red-deep)]">{error}</p>}

      <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--color-line)] bg-white">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-paper-2)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-fog)]">
              {["Name", "Email", "Registered", "Status", "Email", "Last login", "Pools", "Sessions"].map((h, i) => (
                <th key={i} scope="col" className="px-4 py-3 font-medium">{i === 4 ? "Verified" : h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data && !error && <tr><td colSpan={8}><AdminLoadingState /></td></tr>}
            {data && data.users.length === 0 && <tr><td colSpan={8}><AdminEmptyState label="No users match." /></td></tr>}
            {data?.users.map((u) => (
              <tr key={u.id} className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-paper-2)]/60">
                <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                  <Link href={`/admin/qfinance/users/${u.id}`} className="hover:underline">{u.displayName}</Link>
                </td>
                <td className="px-4 py-3 text-[var(--color-fog)]">{u.email}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--color-fog)]">{date(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={u.status === "active" ? "text-green-700" : "text-[var(--color-red-deep)]"}>{u.status === "active" ? "Active" : "Suspended"}</span>
                </td>
                <td className="px-4 py-3 text-[var(--color-fog)]">{u.emailVerified ? "Yes" : u.hasPassword ? "No" : "Not yet (no password set)"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-[var(--color-fog)]">{date(u.lastLoginAt)}</td>
                <td className="px-4 py-3 text-[var(--color-fog)]">{u.poolCount}</td>
                <td className="px-4 py-3 text-[var(--color-fog)]">{u.activeSessions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-[var(--color-line)] bg-white px-3 py-1.5 disabled:opacity-50">Previous</button>
          <span className="text-[var(--color-fog)]">Page {page} of {Math.ceil(data.total / data.pageSize)}</span>
          <button type="button" disabled={page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-[var(--color-line)] bg-white px-3 py-1.5 disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
