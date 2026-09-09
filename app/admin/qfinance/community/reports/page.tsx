"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Check, X } from "lucide-react";
import AdminLoadingState from "@/components/admin/AdminLoadingState";
import AdminEmptyState from "@/components/admin/AdminEmptyState";

type AdminReport = {
  id: number;
  target_type: string;
  target_id: number;
  reason: string;
  status: string;
  created_at: string;
  reporter_display_name: string;
  target_title_or_body: string | null;
};

const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  scam: "Scam",
  harassment: "Harassment",
  misleading_claim: "Misleading financial claim",
  personal_info: "Personal information",
  other: "Other",
};

export default function AdminQFinanceCommunityReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  function load() {
    fetch("/api/admin/qfinance/community/reports")
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok) {
          setError(json.error || "Failed to load reports");
          return;
        }
        setError("");
        setReports(json.reports);
      })
      .catch(() => setError("Failed to load reports"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function resolve(id: number, status: "resolved" | "dismissed") {
    const prev = reports;
    setReports((r) => r.map((rep) => (rep.id === id ? { ...rep, status } : rep)));
    const res = await fetch("/api/admin/qfinance/community/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) setReports(prev);
  }

  const visible = reports.filter((r) => (showResolved ? true : r.status === "open"));
  const openCount = reports.filter((r) => r.status === "open").length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-red)]">
            QFinance · Community
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Reports {openCount > 0 && <span className="text-[var(--color-red)]">({openCount} open)</span>}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/qfinance/community/posts" className="text-sm font-medium text-[var(--color-navy)] hover:underline">
            ← All posts
          </Link>
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
      </div>

      <label className="mt-4 flex w-fit items-center gap-2 text-sm text-[var(--color-fog)]">
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
        Show resolved / dismissed
      </label>

      {error && (
        <p className="mt-4 rounded-md border border-[var(--color-red)]/30 bg-[var(--color-red)]/5 px-3 py-2 text-sm text-[var(--color-red-deep)]">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {loading && <AdminLoadingState label="Loading reports…" />}
        {!loading && visible.length === 0 && <AdminEmptyState label="No open reports." />}
        {!loading &&
          visible.map((r) => (
            <div key={r.id} className="rounded-xl border border-[var(--color-line)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                      {REASON_LABEL[r.reason] ?? r.reason}
                    </span>
                    <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-paper-2)] px-2 py-0.5 text-[11px] text-[var(--color-fog)]">
                      {r.target_type} #{r.target_id}
                    </span>
                    {r.status !== "open" && (
                      <span className="rounded-full border border-[var(--color-line)] px-2 py-0.5 text-[11px] text-[var(--color-fog)]">
                        {r.status}
                      </span>
                    )}
                  </div>
                  {r.target_title_or_body && (
                    <p className="mt-2 line-clamp-2 text-sm text-[var(--color-ink)]">{r.target_title_or_body}</p>
                  )}
                  <p className="mt-2 text-xs text-[var(--color-fog)]">
                    Reported by {r.reporter_display_name} ·{" "}
                    {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>

                {r.status === "open" && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    {r.target_type === "post" && (
                      <a
                        href={`/qfinance/community/${r.target_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-fog)] hover:border-[var(--color-navy)]/40 hover:text-[var(--color-ink)]"
                      >
                        View post
                      </a>
                    )}
                    <button
                      onClick={() => resolve(r.id, "resolved")}
                      className="flex items-center gap-1 rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
                    >
                      <Check size={12} /> Resolve
                    </button>
                    <button
                      onClick={() => resolve(r.id, "dismissed")}
                      className="flex items-center gap-1 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-fog)] hover:bg-[var(--color-paper-2)]"
                    >
                      <X size={12} /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      <p className="mt-6 text-xs text-[var(--color-fog)]">
        Reports don&apos;t auto-hide content. Go to{" "}
        <Link href="/admin/qfinance/community/posts" className="text-[var(--color-navy)] hover:underline">
          Posts
        </Link>{" "}
        to hide or remove the reported item itself.
      </p>
    </div>
  );
}
