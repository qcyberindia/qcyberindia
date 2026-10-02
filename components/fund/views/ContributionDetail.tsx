"use client";

import Link from "next/link";
import type { ContributionDetailDto } from "@/components/fund/api";
import { resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { poolBase } from "@/components/fund/nav";
import { PageHeader, SectionCard } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { usePoolResource } from "@/components/fund/useResource";
import { ActionPanel, AuditTrail, DetailGrid, StageTracker, type WorkflowAction } from "@/components/fund/workflow";

const STAGES = [
  { key: "PENDING", label: "Requested", hint: "Recorded and waiting for an administrator." },
  { key: "APPROVED", label: "Approved", hint: "Waiting for the administrator to confirm the money arrived." },
  { key: "AWAITING_NAV", label: "Awaiting NAV", hint: "Funds confirmed. Units are allocated at the next official end-of-day NAV." },
  { key: "FINALIZED", label: "Finalized", hint: "Units allocated. This record can no longer change." },
];

export function ContributionDetail({ id }: { id: string }) {
  const can = useCan();
  const { poolId, userId } = useFund();
  const res = usePoolResource<ContributionDetailDto>(/^\d{1,9}$/.test(id) ? `contributions/${id}` : null);
  const state = /^\d{1,9}$/.test(id) ? resourceState(res, "the contribution") : null;
  const d = res.data;
  const c = d?.contribution;

  const actions: WorkflowAction[] = [];
  if (c) {
    if (c.status === "PENDING" && can("contributions:approve")) {
      actions.push({ key: "approve", label: "Approve", title: "Approve this contribution?", consequences: "Approval does not allocate units. Next, confirm the money has arrived in the pool's bank account.", success: "Contribution approved." });
      actions.push({ key: "reject", label: "Reject", title: "Reject this contribution?", variant: "danger", consequences: "The request is closed. No units are allocated.", reason: { label: "Reason", min: 3 }, success: "Contribution rejected." });
    }
    if (c.status === "APPROVED" && can("contributions:confirm_funds")) {
      actions.push({ key: "confirm-funds", label: "Confirm funds received", title: "Confirm the money arrived?", consequences: "This fixes the NAV date: the next end-of-day NAV after this moment (by the pool's cutoff time). Units are allocated when that NAV is struck.", success: "Funds confirmed; waiting for the NAV." });
    }
    if (c.status === "AWAITING_NAV" && d?.awaiting?.navOfficial && can("nav:finalize")) {
      actions.push({ key: "finalize", label: "Allocate units now", title: "Finalize at the official NAV?", consequences: `Units are allocated at the official NAV of ${d.awaiting.navDate}. This cannot be undone.`, success: "Units allocated." });
    }
    const ownPending = c.member_id === userId && c.status === "PENDING";
    if (ownPending || (["PENDING", "APPROVED", "AWAITING_NAV"].includes(c.status) && can("contributions:approve"))) {
      actions.push({ key: "cancel", label: "Cancel", title: "Cancel this contribution?", variant: "secondary", consequences: "The request is closed. No units are allocated.", reason: { label: "Reason", min: 3, optional: ownPending }, success: "Contribution cancelled." });
    }
  }

  return (
    <>
      <PageHeader eyebrow="Contribution" title={c ? `Contribution #${c.id}` : "Contribution"} actions={<Link href={`${poolBase(poolId)}/contributions`} className="text-[13px] underline">Back to contributions</Link>} />
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !c || !d ? (
        <SectionCard>Contribution not found.</SectionCard>
      ) : (
        <div className="space-y-6">
          <SectionCard title="Progress">
            <StageTracker stages={STAGES} status={c.status} />
            {d.awaiting && (
              <p className="mt-3 text-[13.5px] text-[var(--qf-ink-soft)]">
                Units will be allocated at the official NAV of <DateDisplay value={d.awaiting.navDate} />
                {d.awaiting.navOfficial ? " (struck)." : " (not struck yet)."}
              </p>
            )}
          </SectionCard>
          <SectionCard title="Details">
            <DetailGrid
              items={[
                { label: "Member", value: d.memberName },
                { label: "Amount", value: <MoneyDisplay value={c.amount} /> },
                { label: "Status", value: <StatusBadge status={c.status} /> },
                { label: "Payment date", value: <DateDisplay value={c.payment_date} /> },
                { label: "Bank reference (UTR)", value: c.utr ?? "—" },
                { label: "Recorded", value: <DateDisplay value={c.created_at} /> },
                { label: "Funds confirmed", value: <DateDisplay value={c.funds_confirmed_at} /> },
                { label: "NAV date", value: <DateDisplay value={c.effective_date} /> },
                { label: "NAV used", value: <MoneyDisplay value={c.nav_used} dp={4} /> },
                { label: "Units allocated", value: <QuantityDisplay value={c.units_allocated} /> },
                { label: "Rounding residual (kept by pool)", value: c.residual ? `₹${c.residual}` : "—" },
                { label: "Finalized", value: <DateDisplay value={c.finalized_at} /> },
              ]}
            />
          </SectionCard>
          <ActionPanel path={`contributions/${c.id}`} actions={actions} onDone={res.reload} />
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
