"use client";

// Where the pool's official NAV stands, shown on the dashboard and the
// contributions page so "Awaiting NAV" is never left unexplained: which
// date requests are waiting for, when that NAV can be struck, and (for the
// roles that strike it) what still blocks it, with a link to the strike.
import Link from "next/link";
import { CalendarClock, CheckCircle2, AlertTriangle } from "lucide-react";
import type { NavStatusDto } from "@/components/fund/api";
import { MoneyDisplay } from "@/components/fund/display";
import { formatCalendarDate, formatTimestampIst } from "@/components/fund/format";
import { poolBase } from "@/components/fund/nav";
import { btnPrimary } from "@/components/fund/parts";
import { useFund } from "@/components/fund/session";
import { usePoolResource } from "@/components/fund/useResource";

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function NavStatusCard({ compact = false }: { compact?: boolean }) {
  const { poolId, role } = useFund();
  const res = usePoolResource<{ status: NavStatusDto }>("nav/status");
  const s = res.data?.status;
  if (!s) return null;
  const next = s.next;
  // Nothing waiting: on the contributions page there is nothing to explain.
  if (!next && compact) return null;

  const strikeHref = next ? `${poolBase(poolId)}/reports?date=${next.navDate}` : `${poolBase(poolId)}/reports`;
  const r = s.readiness;
  const ready = Boolean(r && r.problems.length === 0);
  const waiting = next ? next.contributions + next.withdrawals : 0;

  return (
    <section
      aria-label="NAV status"
      className={`rounded-xl border p-4 sm:p-5 ${next ? "border-[var(--qf-brass)]/50 bg-[var(--qf-brass)]/8" : "border-[var(--qf-line)] bg-[var(--qf-cream-0)]"}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {next ? (
            <CalendarClock size={18} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--qf-up)]" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--qf-ink-soft)]">NAV status</p>
            {next ? (
              <>
                <p className="mt-0.5 font-display text-[16px] font-semibold text-[var(--qf-ink)]">
                  {formatCalendarDate(next.navDate)} · NAV awaiting finalization
                </p>
                <p className="mt-0.5 text-[13.5px] text-[var(--qf-ink-soft)]">
                  {plural(waiting, "request")} waiting ({plural(next.contributions, "contribution")}
                  {next.withdrawals > 0 ? `, ${plural(next.withdrawals, "withdrawal")}` : ""})
                  {next.mine > 0 ? `, ${next.mine} of them yours` : ""}.{" "}
                  {!next.isTradingDay
                    ? "This date is not a trading day."
                    : next.cutoffPassed
                      ? "The cutoff has passed: an administrator can strike this NAV once that day's closing prices are recorded."
                      : `It can be struck after the cutoff, ${formatTimestampIst(next.cutoffAt)}.`}
                </p>
              </>
            ) : s.latest ? (
              <>
                <p className="mt-0.5 font-display text-[16px] font-semibold text-[var(--qf-ink)]">
                  {formatCalendarDate(s.latest.asOfDate)} · NAV <MoneyDisplay value={s.latest.nav} dp={4} />
                </p>
                <p className="mt-0.5 text-[13.5px] text-[var(--qf-ink-soft)]">
                  Finalized {formatTimestampIst(s.latest.createdAt)}. No contributions or withdrawals are waiting for a NAV.
                </p>
              </>
            ) : (
              <p className="mt-0.5 text-[13.5px] text-[var(--qf-ink-soft)]">No official NAV yet, and nothing is waiting for one.</p>
            )}
            {s.due.some((d) => d.official) && (
              <p className="mt-1 text-[13px] text-[var(--qf-down)]">
                Some requests could not be finalized when their NAV was struck. Open each one to see why; an administrator can allocate it from the record.
              </p>
            )}
          </div>
        </div>
        {r && next && (role === "ADMIN" || role === "MANAGER") && (
          <Link href={strikeHref} className={`${btnPrimary} shrink-0 whitespace-nowrap`} aria-disabled={!ready}>
            {ready ? (role === "MANAGER" ? "Review & request NAV" : `Finalize ${formatCalendarDate(next.navDate)} NAV`) : "Review NAV"}
          </Link>
        )}
      </div>
      {r && next && r.problems.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-ink)]">
          {r.problems.map((p) => (
            <li key={p} className="flex gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--qf-down)]" aria-hidden="true" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      )}
      {r && next && ready && r.nav && (
        <p className="mt-3 text-[13px] text-[var(--qf-ink-soft)]">
          Ready for review: computed NAV <MoneyDisplay value={r.nav} dp={4} />, {plural(r.dueCount, "request")} will be finalized at it.
        </p>
      )}
    </section>
  );
}
