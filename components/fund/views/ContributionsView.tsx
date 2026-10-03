"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { errorMessage, type Contribution, type ContributionDetailDto, type Member, type Paged } from "@/components/fund/api";
import { isPositiveDecimal, resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { DecimalField, SelectField, TextAreaField, TextField, inputClass } from "@/components/fund/forms";
import { recordHref } from "@/components/fund/nav";
import { useNotice } from "@/components/fund/notices";
import { Drawer, FormDialog } from "@/components/fund/overlays";
import { EmptyState, PageHeader, SectionCard, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable, FilterBar, FilterField, Pagination } from "@/components/fund/table";
import { ProofDropzone, proofFileProblem, readFileBase64 } from "@/components/fund/upload";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { todayIstInput } from "@/components/fund/views/shared";
import { ContributionReview, ContributionReviewActions, PAYMENT_METHOD_LABEL } from "@/components/fund/views/ContributionReview";

const STATUSES = ["PENDING", "APPROVED", "AWAITING_NAV", "FINALIZED", "REJECTED", "CANCELLED"];
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending approval",
  APPROVED: "Approved",
  AWAITING_NAV: "Awaiting NAV",
  FINALIZED: "Finalized",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

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
  const [fields, setFields] = useState<Record<string, string>>({});
  const forSomeoneElse = Number(memberId) !== userId;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Record a contribution"
      description="For a payment already made to the pool's bank account."
      submitLabel="Submit for review"
      pending={pending}
      error={error}
      onSubmit={async () => {
        setError(null);
        setFields({});
        if (!isPositiveDecimal(amount, 2)) return setFields({ amount: "Enter an amount greater than zero, up to 2 decimals." });
        if (paymentDate > todayIstInput()) return setFields({ paymentDate: "The payment date cannot be in the future." });
        const problem = proofFileProblem(file);
        if (problem) return setFields({ file: problem });
        try {
          const created = await run<{ contribution: { id: number } }>("contributions", {
            amount,
            paymentDate,
            paymentMethod,
            utr: utr.trim() || undefined,
            notes: notes.trim() || undefined,
            memberId: forSomeoneElse ? Number(memberId) : undefined,
          });
          if (file) {
            try {
              await run(`contributions/${created.contribution.id}/proofs`, { fileName: file.name, dataBase64: await readFileBase64(file), kind: "PAYMENT" });
            } catch (err) {
              notify("error", `Contribution submitted, but the payment proof was not attached: ${errorMessage(err)} Open the contribution to attach it.`);
              onDone();
              onClose();
              return;
            }
          }
          notify("success", "Contribution submitted for review.");
          onDone();
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <ol className="grid gap-2 rounded-lg border border-[var(--qf-line)] bg-[var(--qf-cream-1)]/60 p-3 text-[12.5px] leading-snug text-[var(--qf-ink-soft)] sm:grid-cols-3">
        <li>
          <span className="font-semibold text-[var(--qf-ink)]">1. You submit</span>{" "}the payment with proof.
        </li>
        <li>
          <span className="font-semibold text-[var(--qf-ink)]">2. An administrator</span>{" "}checks it against the pool&apos;s bank statement.
        </li>
        <li>
          <span className="font-semibold text-[var(--qf-ink)]">3. Units</span>{" "}are allocated at the next official end-of-day NAV.
        </li>
      </ol>
      {members.data && (
        <SelectField
          label="Contributor"
          value={memberId}
          onChange={setMemberId}
          hint={forSomeoneElse ? "You are recording this on the member's behalf." : undefined}
          options={members.data.members
            .filter((m) => m.status === "active")
            .map((m) => ({ value: String(m.userId), label: m.userId === userId ? `${m.name} (you)` : m.name }))}
        />
      )}
      <fieldset className="space-y-4">
        <legend className="mb-1 font-display text-[15px] font-semibold">Payment details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <DecimalField label="Amount (₹)" value={amount} onChange={setAmount} decimals={2} required error={fields.amount} />
          <TextField label="Payment date" type="date" value={paymentDate} onChange={setPaymentDate} required error={fields.paymentDate} />
          <SelectField label="Payment method" value={paymentMethod} onChange={setPaymentMethod} options={Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => ({ value, label }))} />
          <TextField label="UTR / reference" value={utr} onChange={setUtr} maxLength={64} hint="From your bank or UPI app. Catches duplicate entries." />
        </div>
      </fieldset>
      <ProofDropzone
        label="Payment proof"
        hint="Recommended: a screenshot or PDF of the payment, such as the UPI success screen or bank receipt."
        file={file}
        onChange={(f) => {
          setFile(f);
          setFields((x) => ({ ...x, file: "" }));
        }}
        error={fields.file || null}
        disabled={pending}
      />
      <TextAreaField label="Note for the reviewer" value={notes} onChange={setNotes} maxLength={1000} rows={2} hint="Optional. For example, which account you paid from." />
    </FormDialog>
  );
}

function ReviewDrawer({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const res = usePoolResource<ContributionDetailDto>(id ? `contributions/${id}` : null);
  const state = id ? resourceState(res, "the contribution") : null;
  const reload = () => {
    res.reload();
    onChanged();
  };
  return (
    <Drawer
      open={id !== null}
      onClose={onClose}
      side="right"
      size="wide"
      title={id ? `Contribution #${id}` : "Contribution"}
      footer={res.data ? <ContributionReviewActions d={res.data} onDone={reload} /> : undefined}
    >
      {state ? <div className="p-5">{state}</div> : res.data && <ContributionReview d={res.data} onDone={reload} />}
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
  const reviewer = can("contributions:approve");

  return (
    <>
      <PageHeader
        title="Contributions"
        description="Money members put into the pool. An administrator reviews each payment; units are allocated at the next official end-of-day NAV."
        actions={
          canCreate ? (
            <button type="button" className={btnPrimary} onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" /> Record contribution
            </button>
          ) : undefined
        }
      />
      <FilterBar
        dirty={status !== ""}
        onReset={() => {
          setStatus("");
          setPage(1);
        }}
      >
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
                  {STATUS_LABEL[s]}
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
                  {
                    key: "id",
                    header: "Contribution",
                    primary: true,
                    cell: (r) => (
                      <span className="whitespace-nowrap">
                        #{r.id} · {r.memberName}
                      </span>
                    ),
                  },
                  { key: "a", header: "Amount", align: "right", cell: (r) => <span className="whitespace-nowrap"><MoneyDisplay value={r.amount} /></span> },
                  { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                  {
                    key: "p",
                    header: "Payment",
                    cell: (r) => (
                      <span className="whitespace-nowrap">
                        <DateDisplay value={r.paymentDate} />
                        <span className="block text-[12px] text-[var(--qf-ink-soft)]">
                          {r.paymentMethod ? PAYMENT_METHOD_LABEL[r.paymentMethod] : "—"} · {r.proofCount > 0 ? `${r.proofCount} proof${r.proofCount === 1 ? "" : "s"}` : "no proof"}
                        </span>
                      </span>
                    ),
                  },
                  { key: "e", header: "NAV date", hideOnMobile: true, cell: (r) => <span className="whitespace-nowrap"><DateDisplay value={r.effectiveDate} /></span> },
                  { key: "u", header: "Units", align: "right", cell: (r) => <QuantityDisplay value={r.unitsAllocated} /> },
                ]}
                rowAction={(r) => {
                  const needsReview = reviewer && ["PENDING", "APPROVED"].includes(r.status);
                  return (
                    <button type="button" className={`${needsReview ? btnPrimary : btnSecondary} whitespace-nowrap`} onClick={() => setReviewing(r.id)}>
                      {needsReview ? "Review" : "View"}
                    </button>
                  );
                }}
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
