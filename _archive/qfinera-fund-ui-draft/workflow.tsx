"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ApiError, endpoints } from "@/components/fund/api";
import { useFundMutation } from "@/components/fund/useResource";
import { useNotice } from "@/components/fund/notices";
import { ConfirmDialog } from "@/components/fund/overlays";
import { SectionCard, btnDanger, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { StatusBadge } from "@/components/fund/display";

export type Stage = { key: string; label: string; hint: string };

/**
 * Lifecycle tracker. Shows where a record is in a fixed sequence. Terminal
 * states (rejected / cancelled) are shown as a banner instead of a position.
 */
export function StageTracker({
  stages,
  status,
  terminal = ["REJECTED", "CANCELLED"],
}: {
  stages: ReadonlyArray<Stage>;
  status: string;
  terminal?: readonly string[];
}) {
  if (terminal.includes(status)) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-[14px] text-[var(--qf-ink)]">
        <StatusBadge status={status} />
        <span className="text-[var(--qf-ink-soft)]">This request is closed and will not progress further.</span>
      </div>
    );
  }
  const current = stages.findIndex((s) => s.key === status);
  return (
    <ol className="grid gap-3 sm:grid-cols-4" aria-label="Progress">
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

/** Label/value pairs. `children` may be any node, including display components. */
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
  /** The API action segment, e.g. "approve" -> POST {base}/{id}/approve. */
  key: string;
  label: string;
  /** Confirmation dialog title. */
  title: string;
  /** Plain-language consequence shown before the person confirms. */
  consequences: string;
  variant?: "primary" | "danger" | "secondary";
  /** When set, a written reason is required and sent as `reason`. */
  reasonLabel?: string;
  success: string;
};

const VARIANT = { primary: btnPrimary, danger: btnDanger, secondary: btnSecondary } as const;

/**
 * State-driven actions for one record. The caller decides which actions
 * apply (status + permission); every click goes through a confirmation that
 * states the consequence. Nothing is calculated here: the server performs
 * and validates the transition.
 */
export function ApprovalPanel({
  heading = "Actions",
  intro,
  basePath,
  id,
  actions,
  onDone,
}: {
  heading?: string;
  intro?: string;
  basePath: string;
  id: number | string;
  actions: ReadonlyArray<WorkflowAction>;
  onDone: () => void;
}) {
  const { run, pending } = useFundMutation();
  const { notify } = useNotice();
  const [selected, setSelected] = useState<WorkflowAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm(reason: string) {
    if (!selected) return;
    setError(null);
    try {
      await run(endpoints.action(basePath, id, selected.key), { body: reason ? { reason } : {} });
      notify("success", selected.success);
      setSelected(null);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <SectionCard title={heading} description={intro}>
      {actions.length === 0 ? (
        <p className="text-[13.5px] text-[var(--qf-ink-soft)]">No actions are available for this record in its current state.</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              className={VARIANT[a.variant ?? "primary"]}
              onClick={() => {
                setError(null);
                setSelected(a);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={selected !== null}
        title={selected?.title ?? ""}
        consequences={selected?.consequences}
        confirmLabel={selected?.label ?? "Confirm"}
        destructive={selected?.variant === "danger"}
        reasonLabel={selected?.reasonLabel}
        pending={pending}
        error={error}
        onConfirm={confirm}
        onCancel={() => setSelected(null)}
      />
    </SectionCard>
  );
}
