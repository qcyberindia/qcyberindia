"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/components/fund/api";
import { ConfirmDialog } from "@/components/fund/ConfirmDialog";
import { buttonClass, secondaryButtonClass } from "@/components/fund/ui";

export type ContributionAction = "approve" | "confirm-funds" | "reject" | "cancel" | "finalize";

const COPY: Record<
  ContributionAction,
  { label: string; title: string; description: string; confirm: string; reason: "none" | "optional" | "required"; primary: boolean }
> = {
  approve: {
    label: "Approve",
    title: "Approve this contribution?",
    description:
      "Approving confirms the request is valid. It does not allocate any units: units are allocated at the applicable official end-of-day NAV, after you confirm the funds were received.",
    confirm: "Approve",
    reason: "none",
    primary: true,
  },
  "confirm-funds": {
    label: "Confirm funds received",
    title: "Confirm the funds were received?",
    description:
      "This records that the money reached the fund's account and starts the wait for the next official end-of-day NAV. Only confirm when the funds have actually arrived.",
    confirm: "Confirm funds received",
    reason: "none",
    primary: true,
  },
  finalize: {
    label: "Finalize at official NAV",
    title: "Finalize this contribution?",
    description:
      "This allocates units at the official NAV for the applicable date and posts the ledger entry. It cannot be edited afterwards; any correction is made with a reversal.",
    confirm: "Finalize",
    reason: "none",
    primary: true,
  },
  reject: {
    label: "Reject",
    title: "Reject this contribution?",
    description: "The member will see it as rejected. No units are issued and nothing is posted to the ledger.",
    confirm: "Reject contribution",
    reason: "required",
    primary: false,
  },
  cancel: {
    label: "Cancel contribution",
    title: "Cancel this contribution?",
    description: "The request is closed. No units are issued and nothing is posted to the ledger.",
    confirm: "Cancel contribution",
    reason: "optional",
    primary: false,
  },
};

export function ContributionActions({
  fundId,
  id,
  actions,
}: {
  fundId: number;
  id: number;
  /** Decided on the server from the caller's role and the current status. */
  actions: ContributionAction[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState<ContributionAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (actions.length === 0) return null;

  async function run(action: ContributionAction, reason: string) {
    setBusy(true);
    setError(null);
    const result = await postJson<unknown>(`/api/qfinera/fund/contributions/${id}?fund=${fundId}`, {
      action,
      ...(reason ? { reason } : {}),
    });
    setBusy(false);
    if (result.ok) {
      setOpen(null);
      router.refresh();
    } else {
      setError(result.error.message);
    }
  }

  const current = open ? COPY[open] : null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          className={COPY[action].primary ? buttonClass : secondaryButtonClass}
          onClick={() => {
            setError(null);
            setOpen(action);
          }}
        >
          {COPY[action].label}
        </button>
      ))}

      {open && current ? (
        <ConfirmDialog
          title={current.title}
          description={current.description}
          confirmLabel={current.confirm}
          reason={current.reason}
          busy={busy}
          error={error}
          onConfirm={(reason) => void run(open, reason)}
          onCancel={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
