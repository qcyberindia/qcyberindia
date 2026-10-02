"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { errorMessage, type Contribution, type Member, type Paged } from "@/components/fund/api";
import { isPositiveDecimal, resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { DecimalField, SelectField, TextField } from "@/components/fund/forms";
import { recordHref } from "@/components/fund/nav";
import { useNotice } from "@/components/fund/notices";
import { FormDialog } from "@/components/fund/overlays";
import { EmptyState, PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable, FilterBar, FilterField, Pagination } from "@/components/fund/table";
import { inputClass } from "@/components/fund/forms";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { todayIstInput } from "@/components/fund/views/shared";

const STATUSES = ["PENDING", "APPROVED", "AWAITING_NAV", "FINALIZED", "REJECTED", "CANCELLED"];

function NewContribution({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const can = useCan();
  const { userId } = useFund();
  const members = usePoolResource<{ members: Member[] }>(open && can("contributions:create_for_member") ? "members" : null);
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [memberId, setMemberId] = useState(String(userId));
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayIstInput());
  const [utr, setUtr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Record a contribution"
      description="Record a bank transfer already made to the pool's account. Units are allocated only at the next official end-of-day NAV after the administrator confirms the money arrived."
      submitLabel="Submit for approval"
      pending={pending}
      error={error}
      onSubmit={async () => {
        setError(null);
        setFields({});
        if (!isPositiveDecimal(amount, 2)) {
          setFields({ amount: "Enter an amount greater than zero, up to 2 decimals" });
          return;
        }
        try {
          await run("contributions", {
            amount,
            paymentDate,
            utr: utr.trim() || undefined,
            memberId: Number(memberId) === userId ? undefined : Number(memberId),
          });
          notify("success", "Contribution submitted for approval.");
          onDone();
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      {members.data && (
        <SelectField
          label="Member"
          value={memberId}
          onChange={setMemberId}
          options={members.data.members.filter((m) => m.status === "active").map((m) => ({ value: String(m.userId), label: m.name }))}
        />
      )}
      <DecimalField label="Amount (₹)" value={amount} onChange={setAmount} decimals={2} required error={fields.amount} />
      <TextField label="Payment date" type="date" value={paymentDate} onChange={setPaymentDate} required />
      <TextField label="Bank reference (UTR)" value={utr} onChange={setUtr} maxLength={64} hint="Optional. Used to catch duplicate entries of the same transfer." />
    </FormDialog>
  );
}

export function ContributionsView() {
  const can = useCan();
  const { poolId } = useFund();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const res = usePoolResource<Paged<"contributions", Contribution>>("contributions", { status, page });
  const state = resourceState(res, "contributions");
  const rows = res.data?.contributions ?? [];
  const canCreate = can("contributions:create_own");

  return (
    <>
      <PageHeader
        title="Contributions"
        description="Money members put into the pool. Pending → approved → funds confirmed (awaiting NAV) → finalized with units."
        actions={
          canCreate ? (
            <button type="button" className={btnPrimary} onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" /> Record contribution
            </button>
          ) : undefined
        }
      />
      <FilterBar dirty={status !== ""} onReset={() => setStatus("")}>
        <FilterField label="Status">
          {(id) => (
            <select
              id={id}
              className={inputClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "AWAITING_NAV" ? "Awaiting NAV" : s.charAt(0) + s.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          )}
        </FilterField>
      </FilterBar>
      <SectionCard flush>
        {state ??
          (rows.length === 0 ? (
            <EmptyState title="No contributions" description={status ? "None with this status." : "Contributions appear here once recorded."} />
          ) : (
            <>
              <DataTable
                caption="Contributions"
                rows={rows}
                rowKey={(r) => r.id}
                rowHref={(r) => recordHref(poolId, "contributions", r.id)}
                columns={[
                  { key: "id", header: "Contribution", primary: true, cell: (r) => `#${r.id}` },
                  { key: "m", header: "Member", cell: (r) => r.memberName },
                  { key: "a", header: "Amount", align: "right", cell: (r) => <MoneyDisplay value={r.amount} /> },
                  { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                  { key: "p", header: "Paid on", cell: (r) => <DateDisplay value={r.paymentDate} /> },
                  { key: "e", header: "NAV date", cell: (r) => <DateDisplay value={r.effectiveDate} /> },
                  { key: "n", header: "NAV used", align: "right", hideOnMobile: true, cell: (r) => <MoneyDisplay value={r.navUsed} dp={4} /> },
                  { key: "u", header: "Units", align: "right", cell: (r) => <QuantityDisplay value={r.unitsAllocated} /> },
                ]}
              />
              <Pagination page={page} pageSize={res.data?.pageSize ?? 25} total={res.data?.total ?? null} count={rows.length} onPage={setPage} />
            </>
          ))}
      </SectionCard>
      {canCreate && <NewContribution key={String(creating)} open={creating} onClose={() => setCreating(false)} onDone={res.reload} />}
    </>
  );
}
