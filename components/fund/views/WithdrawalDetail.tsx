"use client";

import Link from "next/link";
import type { WithdrawalDetailDto } from "@/components/fund/api";
import { resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { humanize } from "@/components/fund/format";
import { poolBase } from "@/components/fund/nav";
import { PageHeader, SectionCard } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { usePoolResource } from "@/components/fund/useResource";
import { ActionPanel, AuditTrail, DetailGrid, StageTracker, type WorkflowAction } from "@/components/fund/workflow";

const STAGES = [
  { key: "REQUESTED", label: "Requested", hint: "Waiting for an administrator to approve." },
  { key: "AWAITING_NAV", label: "Approved, awaiting NAV", hint: "Redeemed at the next official end-of-day NAV after approval." },
  { key: "FINALIZED", label: "Finalized", hint: "Units redeemed; the net amount is due to the member. This record can no longer change." },
];

export function WithdrawalDetail({ id }: { id: string }) {
  const can = useCan();
  const { poolId, userId } = useFund();
  const valid = /^\d{1,9}$/.test(id);
  const res = usePoolResource<WithdrawalDetailDto>(valid ? `withdrawals/${id}` : null);
  const state = valid ? resourceState(res, "the withdrawal") : null;
  const d = res.data;
  const w = d?.withdrawal;

  const actions: WorkflowAction[] = [];
  if (w) {
    if (w.status === "REQUESTED" && can("withdrawals:approve")) {
      actions.push({
        key: "approve",
        label: "Approve",
        title: "Approve this withdrawal?",
        consequences:
          "This fixes the NAV date (the next end-of-day NAV after now, by the cutoff time). Units are redeemed when that NAV is struck. If the pool lacks cash then, the request waits.",
        charges: true,
        success: "Withdrawal approved; waiting for the NAV.",
      });
      actions.push({ key: "reject", label: "Reject", variant: "danger", title: "Reject this withdrawal?", consequences: "The request is closed. No units are redeemed.", reason: { label: "Reason", min: 3 }, success: "Withdrawal rejected." });
    }
    if (w.status === "AWAITING_NAV" && d?.awaiting?.navOfficial && can("nav:finalize")) {
      actions.push({ key: "finalize", label: "Redeem now", title: "Finalize at the official NAV?", consequences: `Units are redeemed at the official NAV of ${d.awaiting.navDate}. This cannot be undone.`, success: "Withdrawal finalized." });
    }
    const own = w.member_id === userId && w.status === "REQUESTED";
    if (own || (["REQUESTED", "AWAITING_NAV"].includes(w.status) && can("withdrawals:approve"))) {
      actions.push({ key: "cancel", label: "Cancel request", variant: "secondary", title: "Cancel this withdrawal?", consequences: "The request is closed. No units are redeemed.", reason: { label: "Reason", min: 3, optional: own }, success: "Withdrawal cancelled." });
    }
  }

  return (
    <>
      <PageHeader eyebrow="Withdrawal" title={w ? `Withdrawal #${w.id}` : "Withdrawal"} actions={<Link href={`${poolBase(poolId)}/withdrawals`} className="text-[13px] underline">Back to withdrawals</Link>} />
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !w || !d ? null : (
        <div className="space-y-6">
          <SectionCard title="Progress">
            <StageTracker stages={STAGES} status={w.status} />
            {d.awaiting && (
              <p className="mt-3 text-[13.5px] text-[var(--qf-ink-soft)]">
                Redeems at the official NAV of <DateDisplay value={d.awaiting.navDate} />
                {d.awaiting.navOfficial ? " (struck)." : " (not struck yet)."}
              </p>
            )}
          </SectionCard>
          <SectionCard title="Details">
            <DetailGrid
              items={[
                { label: "Member", value: d.memberName },
                { label: "Member's units now", value: <QuantityDisplay value={d.memberUnits} /> },
                { label: "Request", value: humanize(w.request_type) },
                {
                  label: "Requested",
                  value: w.request_type === "AMOUNT" ? <MoneyDisplay value={w.requested_amount} /> : <span><QuantityDisplay value={w.requested_units} /> units</span>,
                },
                { label: "Status", value: <StatusBadge status={w.status} /> },
                { label: "Charges (kept by pool)", value: <MoneyDisplay value={w.charges} /> },
                { label: "NAV date", value: <DateDisplay value={w.effective_date} /> },
                { label: "NAV used", value: <MoneyDisplay value={w.nav_used} dp={4} /> },
                { label: "Units redeemed", value: <QuantityDisplay value={w.units_redeemed} /> },
                { label: "Gross", value: <MoneyDisplay value={w.gross_amount} /> },
                { label: "Net payout", value: <MoneyDisplay value={w.net_amount} /> },
                { label: "Rounding residual (pool)", value: w.residual ? `₹${w.residual}` : "—" },
              ]}
            />
          </SectionCard>
          <ActionPanel path={`withdrawals/${w.id}`} actions={actions} onDone={res.reload} />
          {d.audit && (
            <SectionCard title="Audit trail" flush>
              <AuditTrail items={d.audit} />
            </SectionCard>
          )}
        </div>
      )}
    </>
  );
}
