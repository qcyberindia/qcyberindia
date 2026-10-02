"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { errorMessage, type Expense, type Paged } from "@/components/fund/api";
import { NoAccess, isPositiveDecimal, resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, StatusBadge } from "@/components/fund/display";
import { DecimalField, SelectField, TextField } from "@/components/fund/forms";
import { humanize } from "@/components/fund/format";
import { useNotice } from "@/components/fund/notices";
import { FormDialog, Modal } from "@/components/fund/overlays";
import { EmptyState, PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";
import { useCan } from "@/components/fund/session";
import { DataTable, Pagination } from "@/components/fund/table";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { ActionPanel, type WorkflowAction } from "@/components/fund/workflow";
import { todayIstInput } from "@/components/fund/views/shared";

const CATEGORIES = ["BROKERAGE_ACCOUNT", "BANK_CHARGES", "DEMAT", "PROFESSIONAL_FEES", "SOFTWARE", "OTHER"];

function NewExpense({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [category, setCategory] = useState("BANK_CHARGES");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayIstInput());
  const [description, setDescription] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Record an expense"
      description="Approved expenses reduce pool cash on the expense date and reach NAV through pool value. They never change anyone's units."
      submitLabel="Submit for approval"
      pending={pending}
      error={error}
      onSubmit={async () => {
        setError(null);
        if (!isPositiveDecimal(amount, 2)) return setError("Enter an amount greater than zero, up to 2 decimals.");
        try {
          await run("expenses", { category, amount, expenseDate, description, paymentReference: paymentReference || undefined });
          notify("success", "Expense submitted for approval.");
          onDone();
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <SelectField label="Category" value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: humanize(c) }))} />
      <DecimalField label="Amount (₹)" value={amount} onChange={setAmount} decimals={2} required />
      <TextField label="Expense date" type="date" value={expenseDate} onChange={setExpenseDate} required />
      <TextField label="Description" value={description} onChange={setDescription} required maxLength={500} />
      <TextField label="Payment reference" value={paymentReference} onChange={setPaymentReference} maxLength={100} />
    </FormDialog>
  );
}

export function ExpensesView() {
  const can = useCan();
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Expense | null>(null);
  const res = usePoolResource<Paged<"expenses", Expense>>(can("expenses:view") ? "expenses" : null, { page });
  if (!can("expenses:view")) return <NoAccess what="Expenses" />;
  const state = resourceState(res, "expenses");
  const rows = res.data?.expenses ?? [];

  const actions: WorkflowAction[] =
    selected?.status === "PENDING" && can("expenses:approve")
      ? [
          { key: "approve", label: "Approve", title: "Approve this expense?", consequences: "Pool cash is reduced on the expense date. Refused if cash would go negative.", backdate: true, success: "Expense approved." },
          { key: "reject", label: "Reject", variant: "danger", title: "Reject this expense?", consequences: "The expense is closed with no effect on cash.", reason: { label: "Reason", min: 3 }, success: "Expense rejected." },
        ]
      : [];

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Pool running costs. Approved by an administrator."
        actions={
          can("expenses:create") ? (
            <button type="button" className={btnPrimary} onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" /> Record expense
            </button>
          ) : undefined
        }
      />
      <SectionCard flush>
        {state ??
          (rows.length === 0 ? (
            <EmptyState title="No expenses recorded" />
          ) : (
            <>
              <DataTable
                caption="Expenses"
                rows={rows}
                rowKey={(r) => r.id}
                columns={[
                  { key: "id", header: "Expense", primary: true, cell: (r) => `#${r.id} ${humanize(r.category)}` },
                  { key: "d", header: "Date", cell: (r) => <DateDisplay value={r.expense_date} /> },
                  { key: "a", header: "Amount", align: "right", cell: (r) => <MoneyDisplay value={r.amount} /> },
                  { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                  { key: "x", header: "Description", hideOnMobile: true, cell: (r) => r.description ?? "—" },
                  { key: "b", header: "Recorded by", hideOnMobile: true, cell: (r) => r.created_by_name ?? "—" },
                ]}
                rowAction={(r) =>
                  r.status === "PENDING" && can("expenses:approve") ? (
                    <button type="button" className="text-[13px] font-semibold text-[var(--qf-brass-dark)] underline" onClick={() => setSelected(r)}>
                      Review
                    </button>
                  ) : null
                }
              />
              <Pagination page={page} pageSize={res.data?.pageSize ?? 25} total={res.data?.total ?? null} count={rows.length} onPage={setPage} />
            </>
          ))}
      </SectionCard>
      {can("expenses:create") && <NewExpense key={String(creating)} open={creating} onClose={() => setCreating(false)} onDone={res.reload} />}
      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected ? `Expense #${selected.id}` : ""}>
        {selected && (
          <div className="p-4">
            <p className="mb-3 text-[14px]">
              {humanize(selected.category)} · <MoneyDisplay value={selected.amount} /> · <DateDisplay value={selected.expense_date} />
            </p>
            <ActionPanel
              path={`expenses/${selected.id}`}
              actions={actions}
              onDone={() => {
                setSelected(null);
                res.reload();
              }}
            />
          </div>
        )}
      </Modal>
    </>
  );
}
