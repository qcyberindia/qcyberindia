"use client";

// Contribution review: payment details, proof files and the lifecycle
// actions the viewer may take. Shared by the contribution page and the
// Review drawer on the contributions list.
import { useState } from "react";
import { FileText, Paperclip } from "lucide-react";
import { errorMessage, poolApi, type ContributionDetailDto } from "@/components/fund/api";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { FormField, inputClass } from "@/components/fund/forms";
import { useNotice } from "@/components/fund/notices";
import { SectionCard, btnSecondary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { usePoolMutation } from "@/components/fund/useResource";
import { ActionPanel, DetailGrid, StageTracker, type WorkflowAction } from "@/components/fund/workflow";

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

export const MAX_PROOF_BYTES = 2 * 1024 * 1024;
export const PROOF_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

/** Reads a file as base64 (no data: prefix). */
export function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]*;base64,/, ""));
    reader.readAsDataURL(file);
  });
}

/** Client-side pre-check only; the server verifies the real file type and size. */
export function proofFileProblem(file: File | null): string | null {
  if (!file) return null;
  if (file.size > MAX_PROOF_BYTES) return "The file is larger than 2 MB.";
  if (!PROOF_ACCEPT.split(",").includes(file.type)) return "Upload a PNG, JPEG or WebP screenshot, or a PDF.";
  return null;
}

/** The lifecycle steps this viewer may take on this contribution now. */
export function contributionActions(
  d: ContributionDetailDto,
  can: (p: Parameters<ReturnType<typeof useCan>>[0]) => boolean,
  userId: number
): WorkflowAction[] {
  const c = d.contribution;
  const own = c.member_id === userId;
  const selfNote = own ? " You are approving your own contribution: this is allowed only for the pool's sole administrator and is recorded in the audit trail as self-confirmed." : "";
  const actions: WorkflowAction[] = [];
  if (c.status === "PENDING" && can("contributions:approve")) {
    actions.push({ key: "approve", label: "Approve", title: "Approve this contribution?", consequences: `Approval does not allocate units. Next, confirm the money has arrived in the pool's bank account.${selfNote}`, success: "Contribution approved." });
    actions.push({ key: "reject", label: "Reject", title: "Reject this contribution?", variant: "danger", consequences: "The request is closed. No units are allocated.", reason: { label: "Reason", min: 3 }, success: "Contribution rejected." });
  }
  if (c.status === "APPROVED" && can("contributions:confirm_funds")) {
    actions.push({ key: "confirm-funds", label: "Confirm funds", title: "Confirm the money arrived?", consequences: `Check the bank statement first. This fixes the NAV date: the next end-of-day NAV after this moment (by the pool's cutoff time). Units are allocated when that NAV is struck.${selfNote}`, success: "Funds confirmed; waiting for the NAV." });
    actions.push({ key: "reject", label: "Reject", title: "Reject this contribution?", variant: "danger", consequences: "The request is closed. No units are allocated.", reason: { label: "Reason", min: 3 }, success: "Contribution rejected." });
  }
  if (c.status === "AWAITING_NAV" && d.awaiting?.navOfficial && can("nav:finalize")) {
    actions.push({ key: "finalize", label: "Allocate units now", title: "Finalize at the official NAV?", consequences: `Units are allocated at the official NAV of ${d.awaiting.navDate}. This cannot be undone.`, success: "Units allocated." });
  }
  const ownPending = own && c.status === "PENDING";
  if (ownPending || (["PENDING", "APPROVED", "AWAITING_NAV"].includes(c.status) && can("contributions:approve"))) {
    actions.push({ key: "cancel", label: "Cancel", title: "Cancel this contribution?", variant: "secondary", consequences: "The request is closed. No units are allocated.", reason: { label: "Reason", min: 3, optional: ownPending }, success: "Contribution cancelled." });
  }
  return actions;
}

function AddProof({ contributionId, onDone }: { contributionId: number; onDone: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const problem = proofFileProblem(file);
  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
      <FormField label="Add payment proof" hint="PNG, JPEG, WebP or PDF, up to 2 MB." error={error ?? problem}>
        {(p) => <input {...p} type="file" accept={PROOF_ACCEPT} className={inputClass} onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }} />}
      </FormField>
      <button
        type="button"
        className={btnSecondary}
        disabled={!file || problem !== null || pending}
        onClick={async () => {
          if (!file) return;
          try {
            await run(`contributions/${contributionId}/proofs`, { fileName: file.name, dataBase64: await readFileBase64(file) });
            notify("success", "Proof attached.");
            setFile(null);
            onDone();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <Paperclip size={15} aria-hidden="true" /> {pending ? "Uploading…" : "Attach"}
      </button>
    </div>
  );
}

export function ContributionReview({ d, onDone }: { d: ContributionDetailDto; onDone: () => void }) {
  const can = useCan();
  const { poolId, userId } = useFund();
  const c = d.contribution;
  const canAddProof = ["PENDING", "APPROVED", "AWAITING_NAV"].includes(c.status) && (c.member_id === userId || can("contributions:create_for_member"));
  const proofUrl = (proofId: number) => poolApi(poolId, `contributions/${c.id}/proofs/${proofId}`);

  return (
    <div className="space-y-6">
      <SectionCard title="Progress">
        <StageTracker stages={CONTRIBUTION_STAGES} status={c.status} />
        {d.awaiting && (
          <p className="mt-3 text-[13.5px] text-[var(--qf-ink-soft)]">
            Units will be allocated at the official NAV of <DateDisplay value={d.awaiting.navDate} />
            {d.awaiting.navOfficial ? " (struck)." : " (not struck yet)."}
          </p>
        )}
      </SectionCard>
      <SectionCard title="Payment details">
        <DetailGrid
          items={[
            { label: "Member", value: d.memberName },
            { label: "Amount", value: <MoneyDisplay value={c.amount} /> },
            { label: "Status", value: <StatusBadge status={c.status} /> },
            { label: "Payment method", value: c.payment_method ? PAYMENT_METHOD_LABEL[c.payment_method] : "—" },
            { label: "UTR / reference", value: c.utr ?? "—" },
            { label: "Payment date", value: <DateDisplay value={c.payment_date} /> },
            { label: "Notes", value: c.notes ?? "—" },
            { label: "Recorded", value: <DateDisplay value={c.created_at} /> },
          ]}
        />
        <div className="mt-5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Payment proof</h3>
          {d.proofs.length === 0 ? (
            <p className="mt-2 text-[13.5px] text-[var(--qf-ink-soft)]">No proof attached.</p>
          ) : (
            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {d.proofs.map((p) => (
                <li key={p.id} className="rounded-md border border-[var(--qf-line)] p-2">
                  <a href={proofUrl(p.id)} target="_blank" rel="noopener noreferrer" className="block">
                    {p.contentType === "application/pdf" ? (
                      <span className="flex h-28 items-center justify-center gap-2 rounded bg-[var(--qf-cream-1)] text-[13px]">
                        <FileText size={18} aria-hidden="true" /> PDF
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- private, authenticated file; not for next/image optimisation
                      <img src={proofUrl(p.id)} alt={`Payment proof: ${p.fileName}`} className="h-28 w-full rounded object-contain bg-[var(--qf-cream-1)]" />
                    )}
                  </a>
                  <p className="mt-1.5 truncate text-[12.5px]" title={p.fileName}>{p.fileName}</p>
                  <p className="text-[11.5px] text-[var(--qf-ink-soft)]">
                    {Math.ceil(p.sizeBytes / 1024)} KB · {p.uploaderName ?? "member"} · <DateDisplay value={p.createdAt} /> ·{" "}
                    <a href={`${proofUrl(p.id)}?download=1`} className="underline">Download</a>
                  </p>
                </li>
              ))}
            </ul>
          )}
          {canAddProof && <AddProof contributionId={c.id} onDone={onDone} />}
        </div>
      </SectionCard>
      {(c.status === "AWAITING_NAV" || c.status === "FINALIZED") && (
        <SectionCard title="Allocation">
          <DetailGrid
            items={[
              { label: "Funds confirmed", value: <DateDisplay value={c.funds_confirmed_at} /> },
              { label: "NAV date", value: <DateDisplay value={c.effective_date} /> },
              { label: "NAV used", value: <MoneyDisplay value={c.nav_used} dp={4} /> },
              { label: "Units allocated", value: <QuantityDisplay value={c.units_allocated} /> },
              { label: "Rounding residual (kept by pool)", value: c.residual ? `₹${c.residual}` : "—" },
              { label: "Finalized", value: <DateDisplay value={c.finalized_at} /> },
            ]}
          />
        </SectionCard>
      )}
      <ActionPanel path={`contributions/${c.id}`} actions={contributionActions(d, can, userId)} onDone={onDone} />
    </div>
  );
}
