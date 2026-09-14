"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Mail } from "lucide-react";
import Link from "next/link";
import AdminLoadingState from "@/components/admin/AdminLoadingState";
import AdminEmptyState from "@/components/admin/AdminEmptyState";

type QFinanceRegistration = { id: number; name: string; email: string; created_at: string };

export default function AdminQFinancePage() {
  const [registrations, setRegistrations] = useState<QFinanceRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/admin/qfinance/registrations")
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok) {
          setError(json.error || "Failed to load registrations");
          return;
        }
        setError("");
        setRegistrations(json.registrations);
      })
      .catch(() => setError("Failed to load registrations"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-red)]">QFinera</p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Beta Registrations
          </h1>
          <div className="mt-2 flex gap-4">
            <Link href="/admin/qfinance/community/posts" className="text-sm font-medium text-[var(--color-navy)] hover:underline">
              Community posts →
            </Link>
            <Link href="/admin/qfinance/community/reports" className="text-sm font-medium text-[var(--color-navy)] hover:underline">
              Community reports →
            </Link>
          </div>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            load();
          }}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3.5 py-1.5 text-sm text-[var(--color-fog)] transition-colors hover:border-[var(--color-navy)]/40 hover:text-[var(--color-ink)] disabled:opacity-60"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <p className="mt-3 max-w-md text-sm text-[var(--color-fog)]">
        Registrations from the live signup form at /qfinance/beta appear below.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-[var(--color-red)]/30 bg-[var(--color-red)]/5 px-3 py-2 text-sm text-[var(--color-red-deep)]">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-[var(--color-line)] bg-white">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-paper-2)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-fog)]">
              <th scope="col" className="px-4 py-3 font-medium">Name</th>
              <th scope="col" className="px-4 py-3 font-medium">Email</th>
              <th scope="col" className="px-4 py-3 font-medium">Registered</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={3}><AdminLoadingState /></td></tr>}
            {!loading && registrations.length === 0 && (
              <tr><td colSpan={3}><AdminEmptyState label="No registrations yet." /></td></tr>
            )}
            {!loading &&
              registrations.map((r) => (
                <tr key={r.id} className="border-b border-[var(--color-line)] transition-colors last:border-0 hover:bg-[var(--color-paper-2)]/60">
                  <td className="px-4 py-3.5 font-medium text-[var(--color-ink)]">{r.name}</td>
                  <td className="px-4 py-3.5 text-[var(--color-fog)]">
                    <a href={`mailto:${r.email}`} className="flex items-center gap-1 hover:text-[var(--color-navy)]">
                      <Mail size={12} /> {r.email}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-fog)]">
                    {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
