"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { errorMessage, type Contribution, type ContributionDetailDto, type Member, type Paged } from "@/components/fund/api";
import { isPositiveDecimal, resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { DecimalField, FormField, SelectField, TextAreaField, TextField } from "@/components/fund/forms";
import { recordHref } from "@/components/fund/nav";
import { useNotice } from "@/components/fund/notices";
import { Drawer, FormDialog } from "@/components/fund/overlays";
import { EmptyState, PageHeader, SectionCard, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable, FilterBar, FilterField, Pagination } from "@/components/fund/table";
import { inputClass } from "@/components/fund/forms";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { todayIstInput } from "@/components/fund/views/shared";
import {
  ContributionReview,
  PAYMENT_METHOD_LABEL,
  PROOF_ACCEPT,
  proofFileProblem,
  readFileBase64,
} from "@/components/fund/views/ContributionReview";

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
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileProblem = proofFileProblem(file);
  const [fields, setFields] = useState<Record<string, string>>({});

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Record a contribution"
      description="Record a payment already made to the pool's account, with proof. An administrator reviews it; units are allocated only at the next official end-of-day NAV after the money is confirmed."
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
        if (fileProblem) return setFields({ file: fileProblem });
        try {
          const created = await run<{ contribution: { id: number } }>("contributions", {
            amount,
            paymentDate,
            paymentMethod,
            utr: utr.trim() || undefined,
            notes: notes.trim() || undefined,
            memberId: Number(memberId) === userId ? undefined : Number(memberId),
          });
          if (file) {
            try {
              await run(`contributions/${created.contribution.id}/proofs`, { fileName: file.name, dataBase64: await readFileBase64(file) });
            } catch (err) {
              notify("error", `Contribution submitted, but the proof was not attached: ${errorMessage(err)} Attach it from the contribution page.`);
              onDone();
              onClose();
              return;
            }
          }
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
      <SelectField label="Payment method" value={paymentMethod} onChange={setPaymentMethod} options={Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label }))} />
      <TextField label="UTR / reference" value={utr} onChange={setUtr} maxLength={64} hint="Optional. Used to catch duplicate entries of the same transfer." />
      <FormField label="Payment proof" hint="Screenshot or PDF of the payment, up to 2 MB." error={fields.file ?? fileProblem}>
        {(p) => <input {...p} type="file" accept={PROOF_ACCEPT} className={inputClass} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
      </FormField>
      <TextAreaField label="Notes" value={notes} onChange={setNotes} maxLength={1000} rows={2} />
    </FormDialog>
  );
}

function ReviewDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const res = usePoolResource<ContributionDetailDto>(id ? `contributions/${id}` : null);
  const state = id ? resourceState(res, "the contribution") : null;
  return (
    <Drawer open={id !== null} onClose={onClose} side="right" title={id ? `Review contribution #${id}` : "Review"} description="Check the payment details and proof against the pool's bank statement before approving or confirming funds.">
      <div className="p-4">
        {state ?? (res.data && (
          <ContributionReview
            d={res.data}
            onDone={() => {
              res.reload();
              onChanged();
            }}
          />
        ))}
      </div>
    </Drawer>
  );
}

export function ContributionsView() {
  const can = useCan();
  const { poolId } = useFund();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const res = usePoolResource<Paged<"contributions", Contribution>>("contributions", { status, page });
  const state = resourceState(res, "contributions");
  const rows = res.data?.contributions ?? [];
  const canCreate = can("contributions:create_own");

  return (
    <>
      <PageHeader
        title="Contributions"
        description="Money members put into the pool. Pending approval → approved → funds confirmed → awaiting NAV → finalized with units."
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
                  { key: "pf", header: "Proof", hideOnMobile: true, cell: (r) => (r.proofCount > 0 ? `${r.proofCount} file${r.proofCount === 1 ? "" : "s"}` : <span className="text-[var(--qf-ink-soft)]">None</span>) },
                ]}
                rowAction={(r) =>
                  can("contributions:approve") || can("contributions:view_all") ? (
                    <button type="button" className={btnSecondary} onClick={() => setReviewing(r.id)}>
                      {can("contributions:approve") && ["PENDING", "APPROVED"].includes(r.status) ? "Review" : "View"}
                    </button>
                  ) : null
                }
              />
              <Pagination page={page} pageSize={res.data?.pageSize ?? 25} total={res.data?.total ?? null} count={rows.length} onPage={setPage} />
            </>
          ))}
      </SectionCard>
      <ReviewDrawer key={reviewing ?? "none"} id={reviewing} onClose={() => setReviewing(null)} onChanged={res.reload} />
      {canCreate && <NewContribution key={String(creating)} open={creating} onClose={() => setCreating(false)} onDone={res.reload} />}
    </>
  );
}
