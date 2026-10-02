"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { errorMessage, type Member, type Paged, type Withdrawal } from "@/components/fund/api";
import { isPositiveDecimal, resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { DecimalField, SelectField, inputClass } from "@/components/fund/forms";
import { recordHref } from "@/components/fund/nav";
import { useNotice } from "@/components/fund/notices";
import { FormDialog } from "@/components/fund/overlays";
import { EmptyState, PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable, FilterBar, FilterField, Pagination } from "@/components/fund/table";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";

const STATUSES = ["REQUESTED", "AWAITING_NAV", "FINALIZED", "REJECTED", "CANCELLED"];

function NewWithdrawal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const can = useCan();
  const { userId } = useFund();
  const members = usePoolResource<{ members: Member[] }>(open ? "members" : null);
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [memberId, setMemberId] = useState(String(userId));
  const [type, setType] = useState<"AMOUNT" | "UNITS">("AMOUNT");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const me = members.data?.members.find((m) => m.userId === Number(memberId));

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Request a withdrawal"
      description="Units are redeemed at the next official end-of-day NAV after an administrator approves. Any withdrawal charge stays in the pool."
      submitLabel="Submit request"
      pending={pending}
      error={error}
      onSubmit={async () => {
        setError(null);
        if (!isPositiveDecimal(value, type === "AMOUNT" ? 2 : 4)) {
          setError(type === "AMOUNT" ? "Enter an amount greater than zero, up to 2 decimals." : "Enter units greater than zero, up to 4 decimals.");
          return;
        }
        try {
          await run("withdrawals", {
            requestType: type,
            ...(type === "AMOUNT" ? { amount: value } : { units: value }),
            memberId: Number(memberId) === userId ? undefined : Number(memberId),
          });
          notify("success", "Withdrawal requested.");
          onDone();
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      {can("withdrawals:create_for_member") && members.data && (
        <SelectField
          label="Member"
          value={memberId}
          onChange={setMemberId}
          options={members.data.members.filter((m) => m.status === "active").map((m) => ({ value: String(m.userId), label: m.name }))}
        />
      )}
      {me && (
        <p className="text-[13px] text-[var(--qf-ink-soft)]">
          Holds <QuantityDisplay value={me.units} /> units, worth <MoneyDisplay value={me.currentValue} /> at the latest official NAV.
        </p>
      )}
      <SelectField
        label="Withdraw by"
        value={type}
        onChange={(v) => setType(v as "AMOUNT" | "UNITS")}
        options={[
          { value: "AMOUNT", label: "Amount in rupees" },
          { value: "UNITS", label: "Number of units" },
        ]}
      />
      <DecimalField label={type === "AMOUNT" ? "Amount (₹)" : "Units"} value={value} onChange={setValue} decimals={type === "AMOUNT" ? 2 : 4} required />
    </FormDialog>
  );
}

export function WithdrawalsView() {
  const can = useCan();
  const { poolId } = useFund();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const res = usePoolResource<Paged<"withdrawals", Withdrawal>>("withdrawals", { status, page });
  const state = resourceState(res, "withdrawals");
  const rows = res.data?.withdrawals ?? [];

  return (
    <>
      <PageHeader
        title="Withdrawals"
        description="Requested → approved (awaiting NAV) → finalized at the official NAV. One open request per member at a time."
        actions={
          can("withdrawals:create_own") ? (
            <button type="button" className={btnPrimary} onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" /> Request withdrawal
            </button>
          ) : undefined
        }
      />
      <FilterBar dirty={status !== ""} onReset={() => setStatus("")}>
        <FilterField label="Status">
          {(id) => (
            <select id={id} className={inputClass} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
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
            <EmptyState title="No withdrawals" />
          ) : (
            <>
              <DataTable
                caption="Withdrawals"
                rows={rows}
                rowKey={(r) => r.id}
                rowHref={(r) => recordHref(poolId, "withdrawals", r.id)}
                columns={[
                  { key: "id", header: "Withdrawal", primary: true, cell: (r) => `#${r.id}` },
                  { key: "m", header: "Member", cell: (r) => r.memberName },
                  {
                    key: "r",
                    header: "Requested",
                    align: "right",
                    cell: (r) => (r.requestType === "AMOUNT" ? <MoneyDisplay value={r.requestedAmount} /> : <span><QuantityDisplay value={r.requestedUnits} /> units</span>),
                  },
                  { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                  { key: "e", header: "NAV date", cell: (r) => <DateDisplay value={r.effectiveDate} /> },
                  { key: "u", header: "Units redeemed", align: "right", cell: (r) => <QuantityDisplay value={r.unitsRedeemed} /> },
                  { key: "n", header: "Net payout", align: "right", cell: (r) => <MoneyDisplay value={r.netAmount} /> },
                ]}
              />
              <Pagination page={page} pageSize={res.data?.pageSize ?? 25} total={res.data?.total ?? null} count={rows.length} onPage={setPage} />
            </>
          ))}
      </SectionCard>
      {can("withdrawals:create_own") && <NewWithdrawal key={String(creating)} open={creating} onClose={() => setCreating(false)} onDone={res.reload} />}
    </>
  );
}
