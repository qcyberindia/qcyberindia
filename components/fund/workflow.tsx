"use client";

import { useId, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { errorMessage } from "@/components/fund/api";
import { DateDisplay, StatusBadge } from "@/components/fund/display";
import { DecimalField, inputClass } from "@/components/fund/forms";
import { humanize } from "@/components/fund/format";
import { useNotice } from "@/components/fund/notices";
import { Modal } from "@/components/fund/overlays";
import { SectionCard, btnDanger, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { usePoolMutation } from "@/components/fund/useResource";
import type { Audit } from "@/components/fund/api";

export type Stage = { key: string; label: string; hint: string };

/** Where a record is in its fixed lifecycle. Terminal states show as a banner. */
export function StageTracker({
  stages,
  status,
  terminal = ["REJECTED", "CANCELLED", "REVERSED"],
}: {
  stages: ReadonlyArray<Stage>;
  status: string;
  terminal?: readonly string[];
}) {
  if (terminal.includes(status)) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <StatusBadge status={status} />
        <span className="text-[var(--qf-ink-soft)]">This record is closed and will not progress further.</span>
      </div>
    );
  }
  const current = stages.findIndex((s) => s.key === status);
  return (
    <ol className={`grid gap-3 sm:grid-cols-2 ${stages.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`} aria-label="Progress">
      {stages.map((s, i) => {
        const done = current > i || (current === i && i === stages.length - 1);
        const active = current === i && !done;
        return (
          <li
            key={s.key}
            aria-current={active ? "step" : undefined}
            className={`rounded-lg border p-3 ${
              active
                ? "border-[var(--qf-brass)] bg-[var(--qf-brass)]/10"
                : done
                  ? "border-[var(--qf-up)]/40 bg-[var(--qf-cream-1)]"
                  : "border-[var(--qf-line)]"
            }`}
          >
            <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--qf-ink)]">
              {done && <Check size={14} className="text-[var(--qf-up)]" aria-hidden="true" />}
              {s.label}
              <span className="sr-only">{done ? " (complete)" : active ? " (current step)" : " (upcoming)"}</span>
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-[var(--qf-ink-soft)]">{s.hint}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Label/value pairs for detail pages. */
export function DetailGrid({ items }: { items: ReadonlyArray<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">{it.label}</dt>
          <dd className="mt-1 break-words text-[14.5px] text-[var(--qf-ink)]">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type WorkflowAction = {
  /** Sent as body.action. */
  key: string;
  label: string;
  title: string;
  /** Plain-language consequence shown before the person confirms. */
  consequences: string;
  variant?: "primary" | "danger" | "secondary";
  /** Require a written reason (sent as `reason`), with a minimum length. */
  reason?: { label: string; min: number; optional?: boolean };
  /** Ask for withdrawal charges (sent as `charges`). */
  charges?: boolean;
  /** Offer the ADMIN backdate correction fields (backdateReason + confirmBackdate). */
  backdate?: boolean;
  /** Require ticking an explicit confirmation (sent as `confirm: true`). */
  confirmText?: string;
  success: string;
};

const VARIANT = { primary: btnPrimary, danger: btnDanger, secondary: btnSecondary } as const;

function ActionForm({
  action,
  path,
  onDone,
  onClose,
}: {
  action: WorkflowAction;
  path: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [reason, setReason] = useState("");
  const [charges, setCharges] = useState("0.00");
  const [backdateReason, setBackdateReason] = useState("");
  const [backdateConfirm, setBackdateConfirm] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reasonId = useId();
  const bdId = useId();

  const reasonOk = !action.reason || action.reason.optional || reason.trim().length >= action.reason.min;
  const blocked = pending || !reasonOk || (action.confirmText !== undefined && !confirmed);

  async function submit() {
    setError(null);
    const body: Record<string, unknown> = { action: action.key };
    if (action.reason && reason.trim()) body.reason = reason.trim();
    if (action.charges) body.charges = charges;
    if (action.backdate && (backdateReason.trim() || backdateConfirm)) {
      body.backdateReason = backdateReason.trim();
      body.confirmBackdate = backdateConfirm;
    }
    if (action.confirmText !== undefined) body.confirm = confirmed;
    try {
      await run(path, body);
      notify("success", action.success);
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!blocked) void submit();
      }}
    >
      <div className="space-y-4 px-5 py-4 text-[14px]">
        <p className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-3 py-2 text-[13px] text-[var(--qf-ink-soft)]">
          {action.consequences}
        </p>
        {action.charges && (
          <DecimalField
            label="Withdrawal charges (kept by the pool)"
            value={charges}
            onChange={setCharges}
            decimals={2}
            hint="Deducted from the payout. Enter 0.00 for none."
          />
        )}
        {action.reason && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={reasonId} className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
              {action.reason.label}
              {!action.reason.optional && <span aria-hidden="true"> *</span>}
            </label>
            <textarea id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className={inputClass} />
            {!action.reason.optional && (
              <p className="text-[12px] text-[var(--qf-ink-soft)]">At least {action.reason.min} characters. Recorded in the audit log.</p>
            )}
          </div>
        )}
        {action.backdate && (
          <fieldset className="space-y-2 rounded-md border border-[var(--qf-line)] p-3">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
              Administrator correction (only if dated on or before the latest official NAV)
            </legend>
            <label htmlFor={bdId} className="sr-only">
              Correction reason
            </label>
            <textarea
              id={bdId}
              value={backdateReason}
              onChange={(e) => setBackdateReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Reason for recording this in an already-struck NAV period"
              className={inputClass}
            />
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" checked={backdateConfirm} onChange={(e) => setBackdateConfirm(e.target.checked)} className="mt-0.5 h-4 w-4" />
              I confirm this backdated correction. Official NAVs already struck are kept unchanged.
            </label>
          </fieldset>
        )}
        {action.confirmText !== undefined && (
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4" />
            {action.confirmText}
          </label>
        )}
        {error && (
          <p role="alert" className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-[var(--qf-line)] px-5 py-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={blocked} className={action.variant === "danger" ? btnDanger : btnPrimary}>
          {pending && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {pending ? "Working…" : action.label}
        </button>
      </div>
    </form>
  );
}

/**
 * State-driven actions for one record. The caller decides which actions
 * apply (status + permission); every action goes through a confirmation that
 * states the consequence. The server performs and validates the transition.
 */
export function ActionPanel({
  heading = "Actions",
  intro,
  path,
  actions,
  onDone,
}: {
  heading?: string;
  intro?: string;
  /** Pool-relative path the action is POSTed to, e.g. "trades/12". */
  path: string;
  actions: ReadonlyArray<WorkflowAction>;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<WorkflowAction | null>(null);
  return (
    <SectionCard title={heading} description={intro}>
      {actions.length === 0 ? (
        <p className="text-[13.5px] text-[var(--qf-ink-soft)]">No actions are available to you for this record in its current state.</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {actions.map((a) => (
            <button key={a.key} type="button" className={VARIANT[a.variant ?? "primary"]} onClick={() => setSelected(a)}>
              {a.label}
            </button>
          ))}
        </div>
      )}
      <Modal open={selected !== null} onClose={() => setSelected(null)} title={selected?.title ?? ""}>
        {selected && <ActionForm action={selected} path={path} onDone={onDone} onClose={() => setSelected(null)} />}
      </Modal>
    </SectionCard>
  );
}

function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** Read-only audit trail: actor, action, reason up front; changes in a <details>. */
export function AuditTrail({ items }: { items: ReadonlyArray<Audit> }) {
  if (items.length === 0) return <p className="px-4 py-6 text-[13.5px] text-[var(--qf-ink-soft)] sm:px-5">No audit entries.</p>;
  return (
    <ol className="divide-y divide-[var(--qf-line)]">
      {items.map((e) => {
        const changes = Object.entries(e.changes ?? {});
        return (
          <li key={e.id} className="px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <p className="text-[14.5px] font-semibold text-[var(--qf-ink)]">
                {humanize(e.action.replace(".", " "))}
                <span className="ml-2 text-[12.5px] font-normal text-[var(--qf-ink-soft)]">
                  {humanize(e.entityType)}
                  {e.entityId !== null ? ` #${e.entityId}` : ""}
                </span>
              </p>
              <DateDisplay value={e.createdAt} className="text-[12.5px] text-[var(--qf-ink-soft)]" />
            </div>
            <p className="mt-0.5 text-[13px] text-[var(--qf-ink-soft)]">by {e.actorName ?? (e.userId ? `User #${e.userId}` : "System")}</p>
            {e.reason && (
              <p className="mt-2 rounded-md bg-[var(--qf-cream-1)] px-3 py-2 text-[13px] text-[var(--qf-ink)]">
                <span className="font-semibold">Reason: </span>
                {e.reason}
              </p>
            )}
            {changes.length > 0 && (
              <details className="mt-2 text-[13px]">
                <summary className="cursor-pointer text-[var(--qf-brass-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]">
                  {changes.length} field{changes.length === 1 ? "" : "s"} changed
                </summary>
                <ul className="mt-2 space-y-1">
                  {changes.map(([field, c]) => (
                    <li key={field} className="break-words text-[var(--qf-ink)]">
                      <span className="text-[var(--qf-ink-soft)]">{humanize(field)}: </span>
                      {renderValue(c.from)} <span aria-label="changed to">&rarr;</span> {renderValue(c.to)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
}
