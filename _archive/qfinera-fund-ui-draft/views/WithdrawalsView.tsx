"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { ApiError, endpoints, itemOf, listOf, type WithdrawalDto } from "@/components/fund/api";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { humanize } from "@/components/fund/format";
import { DecimalField, SelectField, TextField, inputClass } from "@/components/fund/forms";
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
import { withdrawalColumns } from "@/components/fund/views/columns";

const PAGE_SIZE = 20;
const WITHDRAWAL_STATUSES = ["REQUESTED", "APPROVED", "AWAITING_NAV", "FINALIZED", "REJECTED", "CANCELLED"] as const;

const WITHDRAWAL_STAGES: ReadonlyArray<Stage> = [
  { key: "REQUESTED", label: "Requested", hint: "Submitted and waiting for approval." },
  { key: "APPROVED", label: "Approved", hint: "Approved. Waiting to be priced." },
  { key: "AWAITING_NAV", label: "Awaiting NAV", hint: "Waiting for the official end-of-day NAV to price the redemption." },
  { key: "FINALIZED", label: "Finalized", hint: "Units were redeemed and the net payout was set." },
];

const TYPE_OPTIONS = [
  { value: "AMOUNT", label: "A rupee amount" },
  { value: "UNITS", label: "A number of units" },
] as const;

function NewWithdrawalDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const can = useCan();
  const { run, pending } = useFundMutation();
  const { notify } = useNotice();
  const [type, setType] = useState<string>("AMOUNT");
  const [amount, setAmount] = useState("");
  const [units, setUnits] = useState("");
  const [memberId, setMemberId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const forMember = can("withdrawals:create_for_member");

  async function submit() {
    const local: Record<string, string> = {};
    if (type === "AMOUNT" && !isPositiveDecimal(amount, 2)) local.amount = "Enter an amount greater than zero, with up to 2 decimal places.";
    if (type === "UNITS" && !isPositiveDecimal(units, 4)) local.units = "Enter units greater than zero, with up to 4 decimal places.";
    if (forMember && memberId.trim() && !/^\d{1,9}$/.test(memberId.trim())) local.memberId = "Enter a numeric member ID, or leave empty.";
    setErrors(local);
    if (Object.keys(local).length > 0) return;
    setError(null);
    try {
      await run(endpoints.withdrawals, {
        body: {
          requestType: type,
          ...(type === "AMOUNT" ? { amount } : { units }),
          ...(forMember && memberId.trim() ? { memberId: Number(memberId.trim()) } : {}),
        },
      });
      notify("success", "Withdrawal requested. It now waits for approval.");
      setAmount("");
      setUnits("");
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
    <FormDialog open={open} onClose={onClose} title="Request a withdrawal" description="Ask to redeem part of your holding." submitLabel="Submit request" pending={pending} error={error} onSubmit={submit}>
      <Disclaimer>This is a request, not a guaranteed payout. The fund prices it at the official NAV after charges, and the net payout is shown once it is finalized.</Disclaimer>
      <SelectField label="I want to withdraw" value={type} onChange={setType} options={TYPE_OPTIONS} />
      {type === "AMOUNT" ? (
        <DecimalField label="Amount (INR)" required decimals={2} value={amount} onChange={setAmount} error={errors.amount} />
      ) : (
        <DecimalField label="Units" required decimals={4} value={units} onChange={setUnits} error={errors.units} />
      )}
      {forMember && <TextField label="On behalf of member ID" value={memberId} onChange={setMemberId} maxLength={9} hint="Leave empty to request it for yourself." error={errors.memberId} />}
    </FormDialog>
  );
}

export function WithdrawalsView({ initialStatus }: { initialStatus?: string }) {
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(initialStatus && (WITHDRAWAL_STATUSES as readonly string[]).includes(initialStatus) ? initialStatus : "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const res = useFundResource(endpoints.withdrawals, { page, pageSize: PAGE_SIZE, status, from, to }, (j) => listOf<WithdrawalDto>(j));
  const state = resourceState(res, "withdrawals");
  const list = res.data;
  const dirty = Boolean(status || from || to);
  const create = can("withdrawals:create_own") ? (
    <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
      <Plus size={15} aria-hidden="true" /> Request withdrawal
    </button>
  ) : null;

  return (
    <>
      <PageHeader title="Withdrawals" description="Requests to redeem units, from request to final payout." actions={create ? <div className="hidden lg:block">{create}</div> : undefined} />
      <FilterBar dirty={dirty} onReset={() => { setStatus(""); setFrom(""); setTo(""); setPage(1); }}>
        <FilterField label="Status">
          {(id) => (
            <select id={id} className={inputClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {WITHDRAWAL_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
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
            <DataTable columns={withdrawalColumns(true)} rows={list.items} rowKey={(r) => r.id} rowHref={(r) => recordHref("withdrawals", r.id)} caption="Withdrawals" />
            <Pagination page={page} pageSize={PAGE_SIZE} total={list.total} count={list.items.length} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title={dirty ? "No withdrawals match these filters" : "No withdrawals yet"}
            description={dirty ? "Try widening the dates or clearing the status." : "Withdrawal requests appear here."}
            action={!dirty && create ? create : undefined}
          />
        ))}
      </SectionCard>
      {create && <StickyAction>{create}</StickyAction>}
      <NewWithdrawalDialog open={open} onClose={() => setOpen(false)} onDone={res.reload} />
    </>
  );
}

export function WithdrawalDetailView({ id }: { id: number }) {
  const { userId } = useFund();
  const can = useCan();
  const res = useFundResource(`${endpoints.withdrawals}/${id}`, {}, (j) => itemOf<WithdrawalDto>(j));
  const state = resourceState(res, "withdrawal");
  const w = res.data;

  const actions: WorkflowAction[] = [];
  if (w) {
    const mine = w.member_id === userId;
    if (w.status === "REQUESTED" && can("withdrawals:approve")) {
      actions.push({ key: "approve", label: "Approve", title: "Approve this withdrawal?", consequences: "No money moves yet. The redemption is priced at the next official NAV and the net payout is set when it is finalized.", success: "Withdrawal approved." });
    }
    if (w.status === "AWAITING_NAV" && can("nav:finalize")) {
      actions.push({ key: "finalize", label: "Finalize withdrawal", title: "Finalize this withdrawal?", consequences: "Units are redeemed at the official NAV, charges are applied and the net payout is fixed. This cannot be undone here.", success: "Withdrawal finalized." });
    }
    if ((w.status === "REQUESTED" || w.status === "APPROVED") && can("withdrawals:approve")) {
      actions.push({ key: "reject", label: "Reject", title: "Reject this withdrawal?", consequences: "The request is closed and no units are redeemed.", variant: "danger", reasonLabel: "Reason for rejecting", success: "Withdrawal rejected." });
    }
    const adminCancel = can("withdrawals:approve") && ["REQUESTED", "APPROVED", "AWAITING_NAV"].includes(w.status);
    if ((mine && w.status === "REQUESTED") || adminCancel) {
      actions.push({ key: "cancel", label: "Cancel withdrawal", title: "Cancel this withdrawal?", consequences: "The request is closed and will not be processed.", variant: "danger", reasonLabel: mine && w.status === "REQUESTED" ? undefined : "Reason for cancelling", success: "Withdrawal cancelled." });
    }
  }

  return (
    <>
      <p className="mb-3 text-[13px]">
        <Link className="text-[var(--qf-brass-dark)] underline underline-offset-2" href={`${FUND_BASE}/withdrawals`}>&larr; All withdrawals</Link>
      </p>
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !w ? (
        <SectionCard><EmptyState title="Withdrawal not found" description="It may not exist, or you may not have access to it." /></SectionCard>
      ) : (
        <div className="space-y-6">
          <PageHeader title={`Withdrawal #${w.id}`} description={`From ${memberLabel(w.member_name, w.member_id)}`} actions={<StatusBadge status={w.status} />} />
          <SectionCard title="Progress"><StageTracker stages={WITHDRAWAL_STAGES} status={w.status} /></SectionCard>
          <SectionCard title="Request and payout">
            <DetailGrid
              items={[
                { label: "Request type", value: humanize(w.request_type) },
                { label: "Requested amount", value: w.requested_amount ? <MoneyDisplay value={w.requested_amount} /> : "Not applicable" },
                { label: "Requested units", value: w.requested_units ? <QuantityDisplay value={w.requested_units} /> : "Not applicable" },
                { label: "NAV used", value: w.nav_used ? <MoneyDisplay value={w.nav_used} dp={4} /> : "Not priced yet" },
                { label: "Units redeemed", value: w.units_redeemed ? <QuantityDisplay value={w.units_redeemed} /> : "Not priced yet" },
                { label: "Gross amount", value: w.gross_amount ? <MoneyDisplay value={w.gross_amount} /> : "Not priced yet" },
                { label: "Charges", value: <MoneyDisplay value={w.charges} /> },
                { label: "Net payout", value: w.net_amount ? <MoneyDisplay value={w.net_amount} /> : "Not final yet" },
                { label: "Residual", value: w.residual ? <MoneyDisplay value={w.residual} dp={4} /> : "Not final yet" },
              ]}
            />
          </SectionCard>
          <SectionCard title="Dates">
            <DetailGrid
              items={[
                { label: "Requested", value: <DateDisplay value={w.created_at} /> },
                { label: "Approved", value: w.approved_at ? <DateDisplay value={w.approved_at} /> : "Not approved" },
                { label: "Effective date", value: w.effective_date ? <DateDisplay value={w.effective_date} /> : "Set when finalized" },
                { label: "Finalized", value: w.finalized_at ? <DateDisplay value={w.finalized_at} /> : "Not finalized" },
              ]}
            />
          </SectionCard>
          <ApprovalPanel heading="Actions" intro="Each action asks you to confirm before anything changes." basePath={endpoints.withdrawals} id={w.id} actions={actions} onDone={res.reload} />
        </div>
      )}
    </>
  );
}
