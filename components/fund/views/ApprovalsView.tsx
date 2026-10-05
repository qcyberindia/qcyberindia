"use client";

// The pool's approvals queue: join requests from viewers, and changes a
// manager has proposed that only an administrator can apply. Presentation
// only; the API re-checks every decision.
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ClipboardCheck, UserPlus } from "lucide-react";
import { errorMessage, type ChangeRequestDto, type JoinRequestDto } from "@/components/fund/api";
import { resourceState } from "@/components/fund/common";
import { StatusBadge } from "@/components/fund/display";
import { TextAreaField } from "@/components/fund/forms";
import { formatTimestampIst, humanize } from "@/components/fund/format";
import { recordHref } from "@/components/fund/nav";
import { useNotice } from "@/components/fund/notices";
import { Modal } from "@/components/fund/overlays";
import { EmptyState, PageHeader, SectionCard, btnDanger, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { APPROVAL_SENT, isPendingApproval } from "@/components/fund/workflow";

const ENTITY_SECTION: Record<string, string> = {
  contribution: "contributions",
  withdrawal: "withdrawals",
  trade: "trades",
};

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Before → proposed, only for the fields the proposal touches. */
function ChangeTable({ before, proposed }: { before: Record<string, unknown> | null; proposed: Record<string, unknown> | null }) {
  const rows = Object.entries(proposed ?? {}).filter(([k]) => k !== "action" && k !== "reason");
  if (rows.length === 0) return null;
  const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  return (
    <dl className="mt-3 divide-y divide-[var(--qf-line)]/70 rounded-md border border-[var(--qf-line)] text-[13px]">
      {rows.map(([k, v]) => {
        const prev = before?.[k] ?? before?.[snake(k)];
        return (
          <div key={k} className="grid gap-1 px-3 py-2 sm:grid-cols-[10rem_1fr]">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">{humanize(snake(k))}</dt>
            <dd className="min-w-0 break-words">
              {prev !== undefined && (
                <>
                  <span className="text-[var(--qf-ink-soft)] line-through decoration-[var(--qf-ink-soft)]/50">{show(prev)}</span>
                  <span aria-label="changes to" className="px-1.5 text-[var(--qf-ink-soft)]">→</span>
                </>
              )}
              <span className="font-semibold text-[var(--qf-ink)]">{show(v)}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

type Decision = { kind: "change"; request: ChangeRequestDto; action: "approve" | "reject" } | { kind: "join"; request: JoinRequestDto; action: "approve" | "reject" };

function DecisionDialog({ decision, onClose, onDone }: { decision: Decision | null; onClose: () => void; onDone: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!decision) return null;
  const rejecting = decision.action === "reject";
  const needsReason = rejecting && decision.kind === "change";
  const title =
    decision.kind === "join"
      ? `${rejecting ? "Decline" : "Approve"} ${decision.request.displayName ?? "this viewer"} as a member?`
      : `${rejecting ? "Reject" : "Approve"}: ${decision.request.label}?`;
  const consequence =
    decision.kind === "join"
      ? rejecting
        ? "They stay a viewer. They can ask again later."
        : "They become a Member: they can contribute, withdraw and comment. (If you are a manager, an administrator approves this first.)"
      : rejecting
        ? "Nothing changes. The manager sees your reason."
        : "The change is applied now, exactly as if you had made it yourself. All the usual checks run again, and it is recorded in the audit log.";

  return (
    <Modal open onClose={onClose} title={title}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            const path = decision.kind === "join" ? `join-requests/${decision.request.id}` : `requests/${decision.request.id}`;
            const result = await run(path, { action: decision.action, reason: reason.trim() || undefined });
            const pendingAdmin = isPendingApproval(result) || (result as { pendingApproval?: unknown } | null)?.pendingApproval;
            notify("success", pendingAdmin ? APPROVAL_SENT : rejecting ? "Declined." : "Approved and applied.");
            onDone();
            onClose();
          } catch (err) {
            setError(errorMessage(err));
          }
        }}
      >
        <div className="space-y-4 px-5 py-4 text-[14px]">
          <p className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-3 py-2 text-[13px] text-[var(--qf-ink-soft)]">{consequence}</p>
          <TextAreaField
            label={needsReason ? "Reason (required, shared with the requester)" : "Note (optional, recorded in the audit log)"}
            value={reason}
            onChange={setReason}
            maxLength={500}
            rows={3}
          />
          {error && (
            <p role="alert" className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]">
              {error}
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--qf-line)] px-5 py-3 sm:flex-row sm:justify-end">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className={rejecting ? btnDanger : btnPrimary} disabled={pending || (needsReason && reason.trim().length < 3)}>
            {pending ? "Working…" : rejecting ? "Reject" : "Approve"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ChangeRequestCard({ r, onDecide, onCancel }: { r: ChangeRequestDto; onDecide: (action: "approve" | "reject") => void; onCancel: () => void }) {
  const can = useCan();
  const { poolId, userId } = useFund();
  const open = r.status === "PENDING";
  const section = ENTITY_SECTION[r.entityType];
  const name = typeof r.beforeState?.display_name === "string" ? r.beforeState.display_name : null;
  return (
    <li className="rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[16px] font-semibold text-[var(--qf-ink)]">{r.label}</p>
          <p className="mt-0.5 text-[12.5px] text-[var(--qf-ink-soft)]">
            {r.requestedByName ?? "A manager"} · {formatTimestampIst(r.createdAt)}
            {r.entityId !== null && (
              <>
                {" · "}
                {section ? (
                  <Link href={recordHref(poolId, section, r.entityId)} className="underline underline-offset-2">
                    View {humanize(r.entityType).toLowerCase()}
                  </Link>
                ) : name ? (
                  name
                ) : (
                  humanize(r.entityType)
                )}
              </>
            )}
          </p>
        </div>
        <StatusBadge status={r.status} label={r.status === "PENDING" ? "Awaiting admin" : undefined} />
      </div>
      {r.reason && <p className="mt-3 text-[13.5px] text-[var(--qf-ink)]">“{r.reason}”</p>}
      <ChangeTable before={r.beforeState} proposed={r.proposedState} />
      {r.lastError && open && (
        <p className="mt-3 rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[12.5px] text-[var(--qf-down)]">
          Last attempt failed: {r.lastError}
        </p>
      )}
      {!open && r.reviewedAt && (
        <p className="mt-3 text-[12.5px] text-[var(--qf-ink-soft)]">
          {humanize(r.status)} by {r.reviewedByName ?? "—"} · {formatTimestampIst(r.reviewedAt)}
          {r.reviewReason ? ` — ${r.reviewReason}` : ""}
        </p>
      )}
      {open && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {r.requestedBy === userId && (
            <button type="button" className={btnSecondary} onClick={onCancel}>
              Withdraw request
            </button>
          )}
          {can("requests:review") && r.requestedBy !== userId && (
            <>
              <button type="button" className={btnDanger} onClick={() => onDecide("reject")}>
                Reject
              </button>
              <button type="button" className={btnPrimary} onClick={() => onDecide("approve")}>
                Approve and apply
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function ApprovalsView() {
  const can = useCan();
  const { notify } = useNotice();
  const { run } = usePoolMutation();
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [decision, setDecision] = useState<Decision | null>(null);
  const reviewer = can("requests:review");
  const joins = usePoolResource<{ joinRequests: JoinRequestDto[] }>(can("join_requests:review") ? "join-requests" : null, { open: 1 });
  const changes = usePoolResource<{ requests: ChangeRequestDto[] }>(can("requests:view") ? "requests" : null, { status: tab });
  const joinRows = joins.data?.joinRequests ?? [];
  const changeRows = changes.data?.requests ?? [];

  const reload = () => {
    joins.reload();
    changes.reload();
  };

  return (
    <>
      <PageHeader
        title="Approvals"
        description={
          reviewer
            ? "Requests waiting for you. Approving applies the change with your authority; every decision is audited."
            : "Changes you sent to an administrator, and requests from viewers to join."
        }
      />
      <div className="space-y-6">
        {can("join_requests:review") && (
          <SectionCard title="Join requests" description="Viewers asking to become members." flush>
            {joins.loading || joins.error ? (
              resourceState(joins, "join requests")
            ) : joinRows.length === 0 ? (
              <EmptyState icon={UserPlus} title="No one is waiting to join" description="When a viewer asks to become a member, it appears here." />
            ) : (
              <ul className="divide-y divide-[var(--qf-line)]">
                {joinRows.map((j) => (
                  <li key={j.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--qf-ink)]">{j.displayName ?? `Viewer #${j.userId}`}</p>
                      <p className="text-[12.5px] text-[var(--qf-ink-soft)]">Asked {formatTimestampIst(j.createdAt)}</p>
                      {j.note && <p className="mt-2 max-w-xl text-[13.5px] text-[var(--qf-ink)]">“{j.note}”</p>}
                      {j.changeRequestId && <p className="mt-2 text-[12.5px] font-semibold text-[var(--qf-brass-dark)]">Recommended by a manager · awaiting an administrator</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" className={btnSecondary} onClick={() => setDecision({ kind: "join", request: j, action: "reject" })}>
                        Decline
                      </button>
                      {!j.changeRequestId && (
                        <button type="button" className={btnPrimary} onClick={() => setDecision({ kind: "join", request: j, action: "approve" })}>
                          Approve
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {can("requests:view") && (
          <SectionCard
            title={reviewer ? "Manager requests" : "My requests"}
            description="Approval-level changes: roles, contributions, withdrawals, trades, expenses, NAV, settings and deletion."
            actions={
              <div role="tablist" aria-label="Requests" className="flex gap-1 rounded-md border border-[var(--qf-line)] p-0.5">
                {(["open", "closed"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className={`min-h-8 rounded px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)] ${
                      tab === t ? "bg-[var(--qf-brass)]/15 text-[var(--qf-ink)]" : "text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]"
                    }`}
                  >
                    {t === "open" ? "Waiting" : "History"}
                  </button>
                ))}
              </div>
            }
          >
            {changes.loading || changes.error ? (
              resourceState(changes, "requests")
            ) : changeRows.length === 0 ? (
              <EmptyState
                icon={tab === "open" ? CheckCircle2 : ClipboardCheck}
                title={tab === "open" ? "Nothing waiting" : "No decisions yet"}
                description={tab === "open" ? "When a manager proposes an approval-level change, it waits here for an administrator." : undefined}
              />
            ) : (
              <ul className="space-y-3">
                {changeRows.map((r) => (
                  <ChangeRequestCard
                    key={r.id}
                    r={r}
                    onDecide={(action) => setDecision({ kind: "change", request: r, action })}
                    onCancel={async () => {
                      try {
                        await run(`requests/${r.id}`, { action: "cancel" });
                        notify("success", "Request withdrawn.");
                        reload();
                      } catch (err) {
                        notify("error", errorMessage(err));
                      }
                    }}
                  />
                ))}
              </ul>
            )}
          </SectionCard>
        )}
      </div>
      <DecisionDialog key={decision ? `${decision.kind}${decision.request.id}${decision.action}` : "none"} decision={decision} onClose={() => setDecision(null)} onDone={reload} />
    </>
  );
}
