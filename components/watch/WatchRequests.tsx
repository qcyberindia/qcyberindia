"use client";

// Global Watch moderation queue: a platform MANAGER's edits and deletions of
// other people's items, waiting for a platform ADMIN.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { ApiError, apiFetch, errorMessage, type ChangeRequestDto } from "@/components/fund/api";
import { StatusBadge } from "@/components/fund/display";
import { formatTimestampIst } from "@/components/fund/format";
import { EmptyState, ErrorState, LoadingSkeleton, btnDanger, btnPrimary, btnSecondary } from "@/components/fund/parts";

type Req = Omit<ChangeRequestDto, "label">;

export function WatchRequests() {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [data, setData] = useState<{ tab: string; rows: Req[] } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<{ requests: Req[] }>("/api/qfinera/watch/requests", { query: { status: tab } })
      .then((r) => setData({ tab, rows: r.requests }))
      .catch((err: unknown) => setError(err instanceof ApiError ? err : new ApiError("ERROR", errorMessage(err), 0)));
  }, [tab]);
  useEffect(load, [load]);

  async function decide(r: Req, action: "approve" | "reject" | "cancel") {
    let reason: string | undefined;
    if (action === "reject") {
      reason = window.prompt("Reason for rejecting (shared with the moderator):")?.trim();
      if (!reason || reason.length < 3) return;
    }
    setBusy(r.id);
    setNotice(null);
    try {
      await apiFetch(`/api/qfinera/watch/requests/${r.id}`, { body: { action, reason } });
      setNotice(action === "approve" ? "Approved and applied." : action === "reject" ? "Rejected." : "Withdrawn.");
      load();
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState error={error.status === 403 ? "Only Global Watch moderators can see this page." : error} />;
  const rows = data?.tab === tab ? data.rows : null;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Requests" className="inline-flex gap-1 rounded-md border border-[var(--qf-line)] p-0.5">
        {(["open", "closed"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`min-h-9 rounded px-3 text-[13px] font-semibold ${tab === t ? "bg-[var(--qf-brass)]/15 text-[var(--qf-ink)]" : "text-[var(--qf-ink-soft)]"}`}
          >
            {t === "open" ? "Waiting" : "History"}
          </button>
        ))}
      </div>
      {notice && (
        <p role="status" className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-3 py-2 text-[13.5px]">
          {notice}
        </p>
      )}
      {!rows ? (
        <LoadingSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--qf-line)]">
          <EmptyState icon={CheckCircle2} title={tab === "open" ? "Nothing waiting" : "No decisions yet"} />
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-[var(--qf-line)] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-[16px] font-semibold">
                    {r.action === "watch.delete" ? "Delete" : "Edit"}{" "}
                    <Link href={`/qfinera/watch/${r.entityId}`} className="underline underline-offset-2">
                      {typeof r.beforeState?.title === "string" ? r.beforeState.title : `item #${r.entityId}`}
                    </Link>
                  </p>
                  <p className="text-[12.5px] text-[var(--qf-ink-soft)]">
                    {r.requestedByName ?? "A moderator"} · {formatTimestampIst(r.createdAt)}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              {r.reason && <p className="mt-2 text-[13.5px]">“{r.reason}”</p>}
              {r.action === "watch.update" && r.proposedState && (
                <dl className="mt-3 space-y-1 rounded-md border border-[var(--qf-line)] p-3 text-[13px]">
                  {Object.entries(r.proposedState)
                    .filter(([k]) => k !== "reason")
                    .map(([k, v]) => (
                      <div key={k} className="grid gap-1 sm:grid-cols-[8rem_1fr]">
                        <dt className="font-semibold text-[var(--qf-ink-soft)]">{k}</dt>
                        <dd className="break-words">{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</dd>
                      </div>
                    ))}
                </dl>
              )}
              {r.lastError && r.status === "PENDING" && <p className="mt-2 text-[12.5px] text-[var(--qf-down)]">Last attempt failed: {r.lastError}</p>}
              {r.status === "PENDING" && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button type="button" className={btnSecondary} disabled={busy === r.id} onClick={() => void decide(r, "cancel")}>
                    Withdraw (if yours)
                  </button>
                  <button type="button" className={btnDanger} disabled={busy === r.id} onClick={() => void decide(r, "reject")}>
                    Reject
                  </button>
                  <button type="button" className={btnPrimary} disabled={busy === r.id} onClick={() => void decide(r, "approve")}>
                    Approve and apply
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
