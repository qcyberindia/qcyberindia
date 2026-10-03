"use client";

// Contribution review: one flowing record (summary, next step, progress,
// payment details, the contributor's payment proof, the administrator's
// received / verified proof, review history) plus the lifecycle actions the
// viewer may take. Used by the Review drawer on the contributions list and
// by the contribution page.
import { useState } from "react";
import { ArrowRight, FileText, Paperclip, ShieldCheck } from "lucide-react";
import { errorMessage, poolApi, type ContributionDetailDto } from "@/components/fund/api";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { formatTimestampIst, humanize } from "@/components/fund/format";
import { useNotice } from "@/components/fund/notices";
import { btnSecondary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { ProofDropzone, formatBytes, proofFileProblem, readFileBase64 } from "@/components/fund/upload";
import { usePoolMutation } from "@/components/fund/useResource";
import { ActionBar, StepIndicator, type WorkflowAction } from "@/components/fund/workflow";

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  UPI: "UPI",
  IMPS: "IMPS",
  NEFT: "NEFT",
  RTGS: "RTGS",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
  CASH: "Cash",
  OTHER: "Other",
};

export const CONTRIBUTION_STAGES = [
  { key: "PENDING", label: "Pending approval", hint: "Recorded and waiting for an administrator to review." },
  { key: "APPROVED", label: "Approved", hint: "Waiting for the administrator to confirm the money arrived." },
  { key: "FUNDS_CONFIRMED", label: "Funds confirmed", hint: "The money is in the pool's account. This fixes the NAV date." },
  { key: "AWAITING_NAV", label: "Awaiting NAV", hint: "Units are allocated at the next official end-of-day NAV." },
  { key: "FINALIZED", label: "Finalized", hint: "Units allocated. This record can no longer change." },
];

type Can = ReturnType<typeof useCan>;
type Proof = ContributionDetailDto["proofs"][number];

/** The lifecycle steps this viewer may take on this contribution now. The first primary one is the next step. */
export function contributionActions(d: ContributionDetailDto, can: Can, userId: number): WorkflowAction[] {
  const c = d.contribution;
  const own = c.member_id === userId;
  const selfNote = own
    ? " This is your own contribution: allowed only for the pool's sole administrator, and recorded in the audit trail as self-confirmed."
    : "";
  const note = { label: "Review note", min: 0, optional: true };
  const actions: WorkflowAction[] = [];
  if (c.status === "PENDING" && can("contributions:approve")) {
    actions.push({ key: "approve", label: "Approve", title: "Approve this contribution?", consequences: `Approval does not allocate units. Next, confirm the money has arrived in the pool's bank account.${selfNote}`, reason: note, success: "Contribution approved." });
  }
  if (c.status === "APPROVED" && can("contributions:confirm_funds")) {
    actions.push({ key: "confirm-funds", label: "Confirm funds received", title: "Confirm the money arrived?", consequences: `Check the pool's bank statement first. This fixes the NAV date: the next end-of-day NAV after this moment (by the pool's cutoff time). Units are allocated when that NAV is struck.${selfNote}`, reason: note, success: "Funds confirmed; waiting for the NAV." });
  }
  if (c.status === "AWAITING_NAV" && d.awaiting?.navOfficial && can("nav:finalize")) {
    actions.push({ key: "finalize", label: "Allocate units now", title: "Finalize at the official NAV?", consequences: `Units are allocated at the official NAV of ${d.awaiting.navDate}. This cannot be undone.`, success: "Units allocated." });
  }
  if ((c.status === "PENDING" || c.status === "APPROVED") && can("contributions:approve")) {
    actions.push({ key: "reject", label: "Reject", title: "Reject this contribution?", variant: "danger", consequences: "The request is closed. No units are allocated. The contributor sees the reason.", reason: { label: "Reason", min: 3 }, success: "Contribution rejected." });
  }
  const ownPending = own && c.status === "PENDING";
  if (ownPending || (["PENDING", "APPROVED", "AWAITING_NAV"].includes(c.status) && can("contributions:approve"))) {
    actions.push({ key: "cancel", label: "Cancel", title: "Cancel this contribution?", variant: "secondary", consequences: "The request is closed. No units are allocated.", reason: { label: "Reason", min: 3, optional: ownPending }, success: "Contribution cancelled." });
  }
  return actions;
}

/** One sentence: what happens next, and who does it. */
export function nextStep(d: ContributionDetailDto, can: Can, userId: number): string {
  const c = d.contribution;
  const admin = can("contributions:approve");
  switch (c.status) {
    case "PENDING":
      return admin
        ? "Review the payment details and payment proof, then approve or reject."
        : c.member_id === userId
          ? "Waiting for an administrator to review your payment."
          : "Waiting for an administrator to review this payment.";
    case "APPROVED":
      return admin
        ? "Check the pool's bank statement. When the money is there, confirm funds received (attach received proof if useful)."
        : "Approved. Waiting for the administrator to confirm the money arrived in the pool's account.";
    case "AWAITING_NAV":
      return d.awaiting?.navOfficial
        ? `The NAV for ${d.awaiting.navDate} is official: units can be allocated now.`
        : `Funds confirmed. Units are allocated when the official NAV for ${d.awaiting?.navDate ?? "the next trading day"} is struck.`;
    case "FINALIZED":
      return "Finalized: units were allocated at the official NAV. This record no longer changes.";
    case "REJECTED":
      return "Rejected. No units were allocated.";
    default:
      return "Cancelled. No units were allocated.";
  }
}

function Section({ title, description, children, icon }: { title: string; description?: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--qf-line)] px-5 py-5 first:border-t-0">
      <h3 className="flex items-center gap-2 font-display text-[16px] font-semibold text-[var(--qf-ink)]">
        {icon}
        {title}
      </h3>
      {description && <p className="mt-0.5 text-[12.5px] text-[var(--qf-ink-soft)]">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Facts({ items }: { items: ReadonlyArray<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--qf-ink-soft)]">{i.label}</dt>
          <dd className="mt-0.5 break-words text-[14px] text-[var(--qf-ink)]">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProofList({ proofs, url, empty }: { proofs: Proof[]; url: (id: number) => string; empty: string }) {
  if (proofs.length === 0) return <p className="text-[13.5px] text-[var(--qf-ink-soft)]">{empty}</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {proofs.map((p) => (
        <li key={p.id} className="flex gap-3 rounded-lg border border-[var(--qf-line)] p-2.5">
          <a href={url(p.id)} target="_blank" rel="noopener noreferrer" className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]" aria-label={`Open ${p.fileName}`}>
            {p.contentType === "application/pdf" ? (
              <span className="inline-flex h-16 w-16 items-center justify-center rounded bg-[var(--qf-cream-1)]">
                <FileText size={22} aria-hidden="true" />
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- private, authenticated file; not for next/image optimisation
              <img src={url(p.id)} alt="" className="h-16 w-16 rounded bg-[var(--qf-cream-1)] object-cover" />
            )}
          </a>
          <div className="min-w-0 text-[12.5px]">
            <p className="truncate text-[13.5px] font-semibold" title={p.fileName}>{p.fileName}</p>
            <p className="text-[var(--qf-ink-soft)]">
              {formatBytes(p.sizeBytes)} · {p.uploaderName ?? "Unknown"}
            </p>
            <p className="text-[var(--qf-ink-soft)]">{formatTimestampIst(p.createdAt)}</p>
            <p className="mt-1 flex gap-3">
              <a href={url(p.id)} target="_blank" rel="noopener noreferrer" className="underline">Open</a>
              <a href={`${url(p.id)}?download=1`} className="underline">Download</a>
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AttachProof({ contributionId, kind, label, hint, onDone }: { contributionId: number; kind: "PAYMENT" | "RECEIVED"; label: string; hint: string; onDone: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-4 space-y-2">
      <ProofDropzone label={label} hint={hint} file={file} onChange={(f) => { setFile(f); setError(null); }} error={error} disabled={pending} />
      {file && (
        <button
          type="button"
          className={btnSecondary}
          disabled={proofFileProblem(file) !== null || pending}
          onClick={async () => {
            try {
              await run(`contributions/${contributionId}/proofs`, { fileName: file.name, dataBase64: await readFileBase64(file), kind });
              notify("success", kind === "PAYMENT" ? "Payment proof attached." : "Received proof attached.");
              setFile(null);
              onDone();
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <Paperclip size={15} aria-hidden="true" /> {pending ? "Uploading…" : "Attach file"}
        </button>
      )}
    </div>
  );
}

/** Review history from the audit trail: who did what, with notes and reasons. */
function History({ audit }: { audit: NonNullable<ContributionDetailDto["audit"]> }) {
  return (
    <ol className="space-y-3">
      {audit.map((a) => (
        <li key={a.id} className="flex gap-3 text-[13px]">
          <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--qf-brass)]/70" />
          <div className="min-w-0">
            <p>
              <span className="font-semibold">{humanize(a.action.replace(/^contribution\./, ""))}</span>
              <span className="text-[var(--qf-ink-soft)]"> · {a.actorName ?? "System"} · {formatTimestampIst(a.createdAt)}</span>
            </p>
            {a.reason && <p className="mt-0.5 text-[var(--qf-ink-soft)]">“{a.reason}”</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The record body (no actions). */
export function ContributionReview({ d, onDone }: { d: ContributionDetailDto; onDone: () => void }) {
  const can = useCan();
  const { poolId, userId } = useFund();
  const c = d.contribution;
  const isContributor = c.member_id === userId;
  const recordedForMember = c.created_by === userId && can("contributions:create_for_member");
  const privileged = can("contributions:view_all");
  const url = (id: number) => poolApi(poolId, `contributions/${c.id}/proofs/${id}`);
  const payment = d.proofs.filter((p) => p.kind === "PAYMENT");
  const received = d.proofs.filter((p) => p.kind === "RECEIVED");
  const canAddPayment = (isContributor || recordedForMember) && (c.status === "PENDING" || c.status === "APPROVED");
  const canAddReceived = privileged && !["REJECTED", "CANCELLED"].includes(c.status);
  const terminal = ["REJECTED", "CANCELLED"].includes(c.status);

  return (
    <div>
      <div className="px-5 pb-5 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12.5px] text-[var(--qf-ink-soft)]">
              {d.memberName} · {c.payment_method ? PAYMENT_METHOD_LABEL[c.payment_method] : "Method not given"} · paid <DateDisplay value={c.payment_date} />
            </p>
            <p className="mt-0.5 font-display text-[30px] font-semibold leading-tight tracking-tight">
              <MoneyDisplay value={c.amount} />
            </p>
          </div>
          <StatusBadge status={c.status} />
        </div>
        <p className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13.5px] ${terminal ? "border-[var(--qf-line)] bg-[var(--qf-cream-1)]" : "border-[var(--qf-brass)]/50 bg-[var(--qf-brass)]/10"}`}>
          <ArrowRight size={16} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" aria-hidden="true" />
          <span>
            <span className="font-semibold">Next: </span>
            {nextStep(d, can, userId)}
          </span>
        </p>
        <div className="mt-5">
          <StepIndicator stages={CONTRIBUTION_STAGES} status={c.status} />
        </div>
      </div>

      <Section title="Payment details">
        <Facts
          items={[
            { label: "Member", value: d.memberName },
            { label: "Payment method", value: c.payment_method ? PAYMENT_METHOD_LABEL[c.payment_method] : "—" },
            { label: "UTR / reference", value: c.utr ? <span className="font-mono text-[13px]">{c.utr}</span> : "—" },
            { label: "Payment date", value: <DateDisplay value={c.payment_date} /> },
            { label: "Recorded", value: formatTimestampIst(c.created_at) },
          ]}
        />
        {c.notes && (
          <div className="mt-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--qf-ink-soft)]">Contributor&apos;s note</p>
            <p className="mt-0.5 whitespace-pre-line text-[14px]">{c.notes}</p>
          </div>
        )}
      </Section>

      <Section title="Payment proof" description="From the contributor: their evidence of the payment.">
        <ProofList proofs={payment} url={url} empty={isContributor ? "You have not attached payment proof." : "The contributor did not attach payment proof."} />
        {canAddPayment && (
          <AttachProof contributionId={c.id} kind="PAYMENT" label="Add payment proof" hint="A screenshot or PDF of your payment. It can be added until funds are confirmed." onDone={onDone} />
        )}
      </Section>

      {(privileged || received.length > 0) && (
        <Section
          title="Received / verified proof"
          description="From the administrator or manager: evidence that the money arrived, checked against the pool's bank statement."
          icon={<ShieldCheck size={16} className="text-[var(--qf-up)]" aria-hidden="true" />}
        >
          <ProofList proofs={received} url={url} empty="No received proof attached." />
          {canAddReceived && (
            <AttachProof contributionId={c.id} kind="RECEIVED" label="Attach received proof" hint="Optional. For example a screenshot of the bank statement line showing the credit." onDone={onDone} />
          )}
        </Section>
      )}

      {(c.status === "AWAITING_NAV" || c.status === "FINALIZED") && (
        <Section title="Allocation">
          <Facts
            items={[
              { label: "Funds confirmed", value: c.funds_confirmed_at ? formatTimestampIst(c.funds_confirmed_at) : "—" },
              { label: "NAV date", value: <DateDisplay value={c.effective_date ?? d.awaiting?.navDate} /> },
              { label: "NAV used", value: <MoneyDisplay value={c.nav_used} dp={4} /> },
              { label: "Units allocated", value: <QuantityDisplay value={c.units_allocated} /> },
              { label: "Residual (kept by pool)", value: c.residual ? `₹${c.residual}` : "—" },
              { label: "Finalized", value: c.finalized_at ? formatTimestampIst(c.finalized_at) : "—" },
            ]}
          />
        </Section>
      )}

      {d.audit && d.audit.length > 0 && (
        <Section title="Review notes and history" description="From the audit trail. Notes entered when approving or confirming appear here.">
          <History audit={d.audit} />
        </Section>
      )}
    </div>
  );
}

/** The actions for this viewer, as a button row (drawer footer / page header). */
export function ContributionReviewActions({ d, onDone }: { d: ContributionDetailDto; onDone: () => void }) {
  const can = useCan();
  const { userId } = useFund();
  return (
    <ActionBar
      path={`contributions/${d.contribution.id}`}
      actions={contributionActions(d, can, userId)}
      onDone={onDone}
      empty={<p className="text-[13px] text-[var(--qf-ink-soft)]">No actions for you on this contribution right now.</p>}
    />
  );
}
