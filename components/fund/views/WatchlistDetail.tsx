"use client";

import Link from "next/link";
import { useState } from "react";
import { errorMessage, type WatchComment, type WatchItem } from "@/components/fund/api";
import { resourceState, safeHttpUrl } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QualityBadge, StatusBadge } from "@/components/fund/display";
import { inputClass } from "@/components/fund/forms";
import { humanize } from "@/components/fund/format";
import { poolBase } from "@/components/fund/nav";
import { useNotice } from "@/components/fund/notices";
import { PageHeader, SectionCard, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { DetailGrid } from "@/components/fund/workflow";
import { WATCH_STATUSES } from "@/components/fund/views/WatchlistView";

export function WatchlistDetail({ id }: { id: string }) {
  const can = useCan();
  const { poolId, userId } = useFund();
  const valid = /^\d{1,9}$/.test(id);
  const res = usePoolResource<{ item: WatchItem; comments: WatchComment[] }>(valid ? `watchlist/${id}` : null);
  const state = valid ? resourceState(res, "the watchlist item") : null;
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [comment, setComment] = useState("");
  const item = res.data?.item;
  const link = safeHttpUrl(item?.researchUrl);

  async function act(path: string, body: Record<string, unknown>, success: string, method: "POST" | "PATCH" = "POST") {
    try {
      await run(path, body, method);
      notify("success", success);
      res.reload();
      return true;
    } catch (err) {
      notify("error", errorMessage(err));
      return false;
    }
  }

  return (
    <>
      <PageHeader eyebrow="Watchlist" title={item?.title ?? "Watchlist item"} actions={<Link href={`${poolBase(poolId)}/watchlist`} className="text-[13px] underline">Back to watchlist</Link>} />
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !item ? null : (
        <div className="space-y-6">
          <SectionCard title="Research note">
            <DetailGrid
              items={[
                { label: "Instrument", value: `${item.symbol}${item.exchange ? ` · ${item.exchange}` : ""}${item.instrumentName ? ` · ${item.instrumentName}` : ""}` },
                { label: "Stage", value: <StatusBadge status={item.status} /> },
                {
                  label: "Price",
                  value: item.quote?.available ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <MoneyDisplay value={item.quote.price} dp={4} />
                      <QualityBadge quality={item.quote.quality} stale={item.quote.stale} />
                      <DateDisplay value={item.quote.asOf} className="text-[12px] text-[var(--qf-ink-soft)]" />
                    </span>
                  ) : (
                    <QualityBadge quality="UNAVAILABLE" />
                  ),
                },
                { label: "Added by", value: item.createdByName ?? "—" },
                { label: "Updated", value: <DateDisplay value={item.updatedAt} /> },
                {
                  label: "Research link",
                  value: link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="text-[var(--qf-brass-dark)] underline">
                      Open link
                    </a>
                  ) : (
                    "—"
                  ),
                },
              ]}
            />
            {item.thesis && <p className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-[var(--qf-ink)]">{item.thesis}</p>}
            {(can("watchlist:write") || (can("watchlist:create") && item.createdBy === userId)) && (
              <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--qf-line)] pt-4">
                {!item.archivedAt && (
                  <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
                    Stage
                    <select
                      className={inputClass}
                      value={item.status}
                      disabled={pending}
                      onChange={(e) => void act(`watchlist/${item.id}`, { status: e.target.value }, "Stage updated.", "PATCH")}
                    >
                      {WATCH_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {humanize(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={pending}
                  onClick={() => void act(`watchlist/${item.id}`, { action: item.archivedAt ? "restore" : "archive" }, item.archivedAt ? "Restored." : "Archived.")}
                >
                  {item.archivedAt ? "Restore" : "Archive"}
                </button>
              </div>
            )}
          </SectionCard>
          <SectionCard title={`Discussion (${res.data?.comments.length ?? 0})`}>
            <ol className="space-y-4">
              {(res.data?.comments ?? []).map((c) => (
                <li key={c.id} className="rounded-md border border-[var(--qf-line)] p-3">
                  <p className="text-[12.5px] text-[var(--qf-ink-soft)]">
                    <span className="font-semibold text-[var(--qf-ink)]">{c.authorName}</span> · <DateDisplay value={c.createdAt} />
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[14px]">{c.body}</p>
                </li>
              ))}
            </ol>
            {can("watchlist:comment") && !item.archivedAt && (
              <form
                className="mt-4 space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!comment.trim()) return;
                  if (await act(`watchlist/${item.id}`, { action: "comment", body: comment.trim() }, "Comment added.")) setComment("");
                }}
              >
                <label htmlFor="wl-comment" className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
                  Add a comment
                </label>
                <textarea id="wl-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000} className={inputClass} />
                <button type="submit" className={btnPrimary} disabled={pending || !comment.trim()}>
                  Post comment
                </button>
              </form>
            )}
          </SectionCard>
        </div>
      )}
    </>
  );
}
