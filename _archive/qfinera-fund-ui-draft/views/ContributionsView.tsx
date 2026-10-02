"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiError, endpoints, itemOf, listOf, type ContributionDto } from "@/components/fund/api";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { humanize } from "@/components/fund/format";
import { DecimalField, TextField, inputClass } from "@/components/fund/forms";
import { FormDialog } from "@/components/fund/overlays";
import { Disclaimer, EmptyState, PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";
import { useNotice } from "@/components/fund/notices";
import { useCan, useFund } from "@/components/fund/session";
import { useFundMutation, useFundResource } from "@/components/fund/useResource";
import { FUND_BASE, recordHref } from "@/components/fund/nav";
import { isPositiveDecimal, memberLabel, resourceState } from "@/components/fund/common";
import { StickyAction } from "@/components/fund/shell";
import { DataTable, FilterBar, FilterField, Pagination } from "@/components/fund/table";
import { ApprovalPanel, DetailGrid, StageTracker, type Stage, type WorkflowAction } from "@/components/fund/workflow";
import { contributionColumns } from "@/components/fund/views/columns";

const PAGE_SIZE = 20;
export const CONTRIBUTION_STATUSES = ["PENDING", "APPROVED", "AWAITING_NAV", "FINALIZED", "REJECTED", "CANCELLED"] as const;

export const CONTRIBUTION_STAGES: ReadonlyArray<Stage> = [
  { key: "PENDING", label: "Requested", hint: "Submitted and waiting for approval." },
  { key: "APPROVED", label: "Approved", hint: "Approved. Waiting for the money to be confirmed as received." },
  { key: "AWAITING_NAV", label: "Awaiting NAV", hint: "Funds confirmed. Waiting for the next official end-of-day NAV." },
  { key: "FINALIZED", label: "Finalized", hint: "Units were allocated at the official NAV." },
];

function NewContributionDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const can = useCan();
  const { run, pending } = useFundMutation();
  const { notify } = useNotice();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [utr, setUtr] = useState("");
  const [proof, setProof] = useState("");
  const [memberId, setMemberId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const forMember = can("contributions:create_for_member");

  async function submit() {
    const local: Record<string, string> = {};
    if (!isPositiveDecimal(amount, 2)) local.amount = "Enter an amount greater than zero, with up to 2 decimal places.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) local.paymentDate = "Choose the date the payment was made.";
    if (/^[a-z]+:\/\//i.test(proof.trim())) local.paymentProofReference = "Use a private storage reference, not a web link.";
    if (forMember && memberId.trim() && !/^\d{1,9}$/.test(memberId.trim())) local.memberId = "Enter a numeric member ID, or leave empty.";
    setErrors(local);
    if (Object.keys(local).length > 0) return;
    setError(null);
    try {
      await run(endpoints.contributions, {
        body: {
          amount,
          paymentDate,
          utr: utr.trim() || null,
          paymentProofReference: proof.trim() || null,
          ...(forMember && memberId.trim() ? { memberId: Number(memberId.trim()) } : {}),
        },
      });
      notify("success", "Contribution recorded. It now waits for approval.");
      setAmount("");
      setPaymentDate("");
      setUtr("");
      setProof("");
      setMemberId("");
      onClose();
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        setError(err.message);
      } else setError("Something went wrong. Please try again.");
    }
  }

  return (
    <FormDialog open={open} onClose={onClose} title="New contribution" description="Record a transfer you have made into the fund." submitLabel="Submit contribution" pending={pending} error={error} onSubmit={submit}>
      <Disclaimer>Units are not allocated when you submit. They are allocated after the transfer is confirmed and the next official end-of-day NAV is finalized.</Disclaimer>
      <DecimalField label="Amount (INR)" required decimals={2} value={amount} onChange={setAmount} error={errors.amount} />
      <TextField label="Payment date" type="date" required value={paymentDate} onChange={setPaymentDate} error={errors.paymentDate} />
      <TextField label="UTR / reference number" value={utr} onChange={setUtr} maxLength={40} hint="The bank reference for the transfer. Each UTR can be used once." error={errors.utr} />
      <TextField label="Payment proof reference" value={proof} onChange={setProof} maxLength={200} hint="A private storage reference. Do not paste a public link." error={errors.paymentProofReference} />
      {forMember && <TextField label="On behalf of member ID" value={memberId} onChange={setMemberId} maxLength={9} hint="Leave empty to record it for yourself." error={errors.memberId} />}
    </FormDialog>
  );
}

export function ContributionsView({ initialStatus }: { initialStatus?: string }) {
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(initialStatus && (CONTRIBUTION_STATUSES as readonly string[]).includes(initialStatus) ? initialStatus : "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const res = useFundResource(endpoints.contributions, { page, pageSize: PAGE_SIZE, status, from, to }, (j) => listOf<ContributionDto>(j));
  const state = resourceState(res, "contributions");
  const list = res.data;
  const dirty = Boolean(status || from || to);
  const create = can("contributions:create_own") ? (
    <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
      <Plus size={15} aria-hidden="true" /> New contribution
    </button>
  ) : null;

  return (
    <>
      <PageHeader title="Contributions" description="Money paid into the fund, and where each payment is in its journey to units." actions={create ? <div className="hidden lg:block">{create}</div> : undefined} />
      <FilterBar dirty={dirty} onReset={() => { setStatus(""); setFrom(""); setTo(""); setPage(1); }}>
        <FilterField label="Status">
          {(id) => (
            <select id={id} className={inputClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {CONTRIBUTION_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          )}
        </FilterField>
        <FilterField label="From date">
          {(id) => <input id={id} type="date" className={inputClass} value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />}
        </FilterField>
        <FilterField label="To date">
          {(id) => <input id={id} type="date" className={inputClass} value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} />}
        </FilterField>
      </FilterBar>
      <SectionCard flush>
        {state ?? (list && list.items.length > 0 ? (
          <>
            <DataTable columns={contributionColumns(true)} rows={list.items} rowKey={(r) => r.id} rowHref={(r) => recordHref("contributions", r.id)} caption="Contributions" />
            <Pagination page={page} pageSize={PAGE_SIZE} total={list.total} count={list.items.length} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title={dirty ? "No contributions match these filters" : "No contributions yet"}
            description={dirty ? "Try widening the dates or clearing the status." : "Recorded contributions appear here."}
            action={!dirty && create ? create : undefined}
          />
        ))}
      </SectionCard>
      {create && <StickyAction>{create}</StickyAction>}
      <NewContributionDialog open={open} onClose={() => setOpen(false)} onDone={res.reload} />
    </>
  );
}

export function ContributionDetailView({ id }: { id: number }) {
  const { userId } = useFund();
  const can = useCan();
  const res = useFundResource(`${endpoints.contributions}/${id}`, {}, (j) => itemOf<ContributionDto>(j));
  const state = resourceState(res, "contribution");
  const c = res.data;

  const actions: WorkflowAction[] = [];
  if (c) {
    const mine = c.member_id === userId;
    if (c.status === "PENDING" && can("contributions:approve")) {
      actions.push({ key: "approve", label: "Approve", title: "Approve this contribution?", consequences: "No units are allocated yet. Funds must still be confirmed as received, and units follow the next official NAV.", success: "Contribution approved." });
    }
    if (c.status === "APPROVED" && can("contributions:confirm_funds")) {
      actions.push({ key: "confirm-funds", label: "Confirm funds received", title: "Confirm the money was received?", consequences: "This starts the wait for the next end-of-day NAV. The time of confirmation decides which NAV date applies and is recorded.", success: "Funds confirmed. Awaiting the next NAV." });
    }
    if (c.status === "AWAITING_NAV" && can("nav:finalize")) {
      actions.push({ key: "finalize", label: "Finalize contribution", title: "Finalize this contribution?", consequences: "Units are allocated at the official NAV for the applicable date and posted to the ledger. This cannot be undone here. It only works once that NAV is official.", success: "Contribution finalized." });
    }
    if ((c.status === "PENDING" || c.status === "APPROVED") && can("contributions:approve")) {
      actions.push({ key: "reject", label: "Reject", title: "Reject this contribution?", consequences: "The request is closed and the member is not allocated any units.", variant: "danger", reasonLabel: "Reason for rejecting", success: "Contribution rejected." });
    }
    const adminCancel = can("contributions:approve") && ["PENDING", "APPROVED", "AWAITING_NAV"].includes(c.status);
    if ((mine && c.status === "PENDING") || adminCancel) {
      actions.push({ key: "cancel", label: "Cancel contribution", title: "Cancel this contribution?", consequences: "The request is closed and will not be processed.", variant: "danger", reasonLabel: mine && c.status === "PENDING" ? undefined : "Reason for cancelling", success: "Contribution cancelled." });
    }
  }

  return (
    <>
      <p className="mb-3 text-[13px]">
        <Link className="text-[var(--qf-brass-dark)] underline underline-offset-2" href={`${FUND_BASE}/contributions`}>&larr; All contributions</Link>
      </p>
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !c ? (
        <SectionCard><EmptyState title="Contribution not found" description="It may not exist, or you may not have access to it." /></SectionCard>
      ) : (
        <div className="space-y-6">
          <PageHeader title={`Contribution #${c.id}`} description={`From ${memberLabel(null, c.member_id)}`} actions={<StatusBadge status={c.status} />} />
          <SectionCard title="Progress">
            <StageTracker stages={CONTRIBUTION_STAGES} status={c.status} />
            {c.status === "AWAITING_NAV" && (
              <p className="mt-4 text-[13.5px] text-[var(--qf-ink-soft)]">Units are allocated only when the applicable end-of-day NAV is official. Nothing is allocated before then.</p>
            )}
          </SectionCard>
          <SectionCard title="Amount and allocation">
            <DetailGrid
              items={[
                { label: "Amount", value: <MoneyDisplay value={c.amount} /> },
                { label: "NAV used", value: c.nav_used ? <MoneyDisplay value={c.nav_used} dp={4} /> : "Not allocated yet" },
                { label: "Units allocated", value: c.units_allocated ? <QuantityDisplay value={c.units_allocated} /> : "Not allocated yet" },
                { label: "Residual kept by the fund", value: c.residual ? <MoneyDisplay value={c.residual} dp={4} /> : "Not allocated yet" },
                { label: "Effective date", value: c.effective_date ? <DateDisplay value={c.effective_date} /> : "Set when finalized" },
                { label: "Finalized", value: c.finalized_at ? <DateDisplay value={c.finalized_at} /> : "Not finalized" },
              ]}
            />
          </SectionCard>
          <SectionCard title="Dates and references">
            <DetailGrid
              items={[
                { label: "Payment date", value: <DateDisplay value={c.payment_date} /> },
                { label: "Requested", value: <DateDisplay value={c.created_at} /> },
                { label: "Approved", value: c.approved_at ? <DateDisplay value={c.approved_at} /> : "Not approved" },
                { label: "Funds confirmed", value: c.funds_confirmed_at ? <DateDisplay value={c.funds_confirmed_at} /> : "Not confirmed" },
                { label: "UTR", value: c.utr ?? "None recorded" },
                { label: "Payment proof", value: c.payment_proof_reference ? "Stored privately" : "None attached" },
              ]}
            />
          </SectionCard>
          <ApprovalPanel heading="Actions" intro="Each action asks you to confirm before anything changes." basePath={endpoints.contributions} id={c.id} actions={actions} onDone={res.reload} />
        </div>
      )}
    </>
  );
}
