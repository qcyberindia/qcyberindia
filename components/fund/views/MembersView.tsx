"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { errorMessage, type Invite, type Member } from "@/components/fund/api";
import { resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, PercentDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { SelectField, TextField, inputClass } from "@/components/fund/forms";
import { humanize } from "@/components/fund/format";
import { useNotice } from "@/components/fund/notices";
import { FormDialog, Modal } from "@/components/fund/overlays";
import { EmptyState, PageHeader, SectionCard, btnDanger, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useAuthority, useCan, useCanAct, useFund } from "@/components/fund/session";
import { DataTable } from "@/components/fund/table";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { APPROVAL_SENT, ApprovalNotice, isPendingApproval } from "@/components/fund/workflow";

function InviteDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { role } = useFund();
  const { run, pending } = usePoolMutation();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string; emailSent: boolean } | null>(null);

  function close() {
    setEmail("");
    setResult(null);
    setError(null);
    onClose();
  }

  if (result) {
    return (
      <Modal open={open} onClose={close} title="Invitation created">
        <div className="space-y-3 px-5 py-4 text-[14px]">
          <p>
            {result.emailSent
              ? "The invitation was emailed. You can also share this link directly with them:"
              : "Email is not available right now, so share this link with them directly:"}
          </p>
          <label className="sr-only" htmlFor="invite-link">
            Invitation link
          </label>
          <input id="invite-link" readOnly value={result.link} className={inputClass} onFocus={(e) => e.currentTarget.select()} />
          <p className="text-[12.5px] text-[var(--qf-ink-soft)]">
            This link is shown only now. It works once, only for the invited email address, and expires in 7 days.
          </p>
          <div className="flex justify-end">
            <button type="button" className={btnPrimary} onClick={close}>
              Done
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <FormDialog
      open={open}
      onClose={close}
      title="Invite someone you know"
      description="They join by signing in to QFinera with this email address and opening the link."
      submitLabel="Create invitation"
      pending={pending}
      error={error}
      onSubmit={async () => {
        setError(null);
        try {
          const r = await run<{ link: string; emailSent: boolean }>("invites", { email: email.trim(), role: inviteRole });
          setResult(r);
          onDone();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <TextField label="Email" type="email" value={email} onChange={setEmail} required maxLength={254} />
      <SelectField
        label="Role"
        value={inviteRole}
        onChange={setInviteRole}
        options={(role === "ADMIN" ? ["VIEWER", "MEMBER", "MANAGER", "ADMIN"] : ["VIEWER", "MEMBER"]).map((r) => ({ value: r, label: ROLE_INFO[r].label }))}
        hint={ROLE_INFO[inviteRole]?.summary}
      />
    </FormDialog>
  );
}

export const ROLE_INFO: Record<string, { label: string; summary: string }> = {
  VIEWER: { label: "Viewer", summary: "Read-only. Sees the pool and their own records; can ask to become a member." },
  MEMBER: { label: "Member", summary: "Contributes, withdraws, comments and adds watchlist notes." },
  MANAGER: { label: "Manager", summary: "Runs the pool day to day. Approval-level changes go to an administrator." },
  ADMIN: { label: "Admin", summary: "Full control, including approvals, roles, settings and deleting the pool." },
};
const ROLE_ORDER = ["VIEWER", "MEMBER", "MANAGER", "ADMIN"] as const;
const rank = (r: string) => ROLE_ORDER.indexOf(r as (typeof ROLE_ORDER)[number]);

type MemberChange = { body: Record<string, unknown>; title: string; summary: string; success: string; highRisk: boolean };

function MemberAdminDialog({ member, onClose, onDone }: { member: Member | null; onClose: () => void; onDone: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const proposing = useAuthority()("members:change_role") === "propose";
  const [role, setRole] = useState(member?.role ?? "MEMBER");
  const [change, setChange] = useState<MemberChange | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!member) return null;
  const from = ROLE_INFO[member.role]?.label ?? humanize(member.role);

  function review(next: MemberChange) {
    setError(null);
    setConfirmed(false);
    setChange(next);
  }

  async function submit() {
    if (!change) return;
    setError(null);
    try {
      const result = await run(`members/${member!.userId}`, { ...change.body, reason: reason.trim() || undefined }, "PATCH");
      notify("success", isPendingApproval(result) ? APPROVAL_SENT : change.success);
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const roleChange = (): MemberChange => {
    const to = ROLE_INFO[role]?.label ?? humanize(role);
    const promotion = rank(role) > rank(member.role);
    return {
      body: { role },
      title: `${promotion ? "Promote" : "Change"} ${member.name} from ${from} to ${to}?`,
      summary: `${to}: ${ROLE_INFO[role]?.summary ?? ""}${role === "VIEWER" && member.units !== "0.0000" ? " Their units stay theirs; an administrator can still process withdrawals for them." : ""}`,
      success: `${member.name} is now ${to === "Admin" ? "an" : "a"} ${to}.`,
      highRisk: role === "ADMIN" || role === "MANAGER",
    };
  };

  return (
    <Modal open onClose={onClose} title={change ? "Confirm the change" : `Manage ${member.name}`} description={change ? undefined : `Currently ${from}, ${member.status}.`}>
      <div className="space-y-4 px-5 py-4 text-[14px]">
        {change ? (
          <>
            {proposing && <ApprovalNotice />}
            <div className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-3 py-3">
              <p className="font-display text-[16px] font-semibold text-[var(--qf-ink)]">{change.title}</p>
              <p className="mt-1 text-[13px] text-[var(--qf-ink-soft)]">{change.summary}</p>
            </div>
            <TextField label="Reason (recorded in the audit log)" value={reason} onChange={setReason} maxLength={500} />
            {change.highRisk && (
              <label className="flex items-start gap-2 text-[13px]">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4" />
                I understand this {change.body.status === "removed" ? "removes their access to the pool" : "gives them more control over the pool"}.
              </label>
            )}
          </>
        ) : (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Role</legend>
            {ROLE_ORDER.map((r) => (
              <label
                key={r}
                className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                  role === r ? "border-[var(--qf-brass)] bg-[var(--qf-brass)]/5" : "border-[var(--qf-line)] hover:border-[var(--qf-brass)]/60"
                }`}
              >
                <input type="radio" name="member-role" value={r} checked={role === r} onChange={() => setRole(r)} className="mt-1 h-4 w-4" />
                <span>
                  <span className="font-semibold text-[var(--qf-ink)]">
                    {ROLE_INFO[r].label}
                    {r === member.role && <span className="ml-2 text-[12px] font-normal text-[var(--qf-ink-soft)]">current</span>}
                  </span>
                  <span className="block text-[12.5px] leading-snug text-[var(--qf-ink-soft)]">{ROLE_INFO[r].summary}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {error && (
          <p role="alert" className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-[var(--qf-line)] px-5 py-3 sm:flex-row sm:flex-wrap sm:justify-end">
        {change ? (
          <>
            <button type="button" className={btnSecondary} disabled={pending} onClick={() => setChange(null)}>
              Back
            </button>
            <button
              type="button"
              className={change.body.status === "removed" ? btnDanger : btnPrimary}
              disabled={pending || (change.highRisk && !confirmed)}
              onClick={() => void submit()}
            >
              {pending ? "Working…" : proposing ? "Send for approval" : "Confirm"}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={btnSecondary}
              onClick={() =>
                review({
                  body: { status: "removed" },
                  title: `Remove ${member.name} from the pool?`,
                  summary: "Needs zero units and no open requests. Their history is kept, and they can be invited again later.",
                  success: "Member removed.",
                  highRisk: true,
                })
              }
            >
              Remove
            </button>
            {member.status === "active" ? (
              <button
                type="button"
                className={btnSecondary}
                onClick={() =>
                  review({
                    body: { status: "suspended" },
                    title: `Suspend ${member.name}?`,
                    summary: "They lose access to the pool until reactivated. Their units and history are untouched.",
                    success: "Member suspended.",
                    highRisk: false,
                  })
                }
              >
                Suspend
              </button>
            ) : (
              <button
                type="button"
                className={btnSecondary}
                onClick={() =>
                  review({ body: { status: "active" }, title: `Reactivate ${member.name}?`, summary: "They regain access with their current role.", success: "Member reactivated.", highRisk: false })
                }
              >
                Reactivate
              </button>
            )}
            <button type="button" className={btnPrimary} disabled={role === member.role} onClick={() => review(roleChange())}>
              Review role change
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

export function MembersView() {
  const can = useCan();
  const canAct = useCanAct();
  const { userId } = useFund();
  const [showRemoved, setShowRemoved] = useState(false);
  const members = usePoolResource<{ members: Member[] }>("members", { removed: showRemoved ? 1 : null });
  const invites = usePoolResource<{ invites: Invite[] }>(can("members:invite") ? "invites" : null);
  const { run } = usePoolMutation();
  const { notify } = useNotice();
  const [inviting, setInviting] = useState(false);
  const [managing, setManaging] = useState<Member | null>(null);
  const state = resourceState(members, "members");

  return (
    <>
      <PageHeader
        title="Members"
        description={can("members:view_all") ? "Everyone in this pool and their share." : "Your membership. Other members' holdings are private."}
        actions={
          can("members:invite") ? (
            <button type="button" className={btnPrimary} onClick={() => setInviting(true)}>
              <UserPlus size={16} aria-hidden="true" /> Invite
            </button>
          ) : undefined
        }
      />
      <div className="space-y-6">
        <SectionCard
          flush
          title="Members"
          actions={
            can("members:view_all") ? (
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} /> Show removed
              </label>
            ) : undefined
          }
        >
          {state ?? (
            <DataTable
              caption="Pool members"
              rows={members.data?.members ?? []}
              rowKey={(r) => r.userId}
              columns={[
                {
                  key: "n",
                  header: "Member",
                  primary: true,
                  cell: (r) => (
                    <span>
                      {r.name}
                      {r.email && <span className="block text-[12px] font-normal text-[var(--qf-ink-soft)]">{r.email}</span>}
                    </span>
                  ),
                },
                { key: "r", header: "Role", cell: (r) => ROLE_INFO[r.role]?.label ?? humanize(r.role) },
                { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                { key: "j", header: "Joined", cell: (r) => <DateDisplay value={r.joinedAt} /> },
                { key: "i", header: "Contributed", align: "right", cell: (r) => <MoneyDisplay value={r.invested} /> },
                { key: "u", header: "Units", align: "right", cell: (r) => <QuantityDisplay value={r.units} /> },
                { key: "v", header: "Value (official NAV)", align: "right", cell: (r) => <MoneyDisplay value={r.currentValue} /> },
                { key: "o", header: "Ownership", align: "right", cell: (r) => <PercentDisplay value={r.ownershipPercent} /> },
              ]}
              rowAction={
                canAct("members:change_role")
                  ? (r) =>
                      r.userId !== userId && r.status !== "removed" ? (
                        <button type="button" className="text-[13px] font-semibold text-[var(--qf-brass-dark)] underline" onClick={() => setManaging(r)}>
                          Manage
                        </button>
                      ) : null
                  : undefined
              }
            />
          )}
        </SectionCard>

        {can("members:invite") && (
          <SectionCard title="Invitations" flush>
            {invites.loading || invites.error ? (
              resourceState(invites, "invitations")
            ) : (invites.data?.invites.length ?? 0) === 0 ? (
              <EmptyState title="No invitations yet" />
            ) : (
              <DataTable
                caption="Invitations"
                rows={invites.data?.invites ?? []}
                rowKey={(r) => r.id}
                columns={[
                  { key: "e", header: "Email", primary: true, cell: (r) => r.email },
                  { key: "r", header: "Role", cell: (r) => ROLE_INFO[r.role]?.label ?? humanize(r.role) },
                  { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                  { key: "c", header: "Sent", cell: (r) => <DateDisplay value={r.createdAt} /> },
                  { key: "x", header: "Expires", cell: (r) => <DateDisplay value={r.expiresAt} /> },
                ]}
                rowAction={(r) =>
                  r.status === "PENDING" ? (
                    <button
                      type="button"
                      className="text-[13px] font-semibold text-[var(--qf-down)] underline"
                      onClick={async () => {
                        try {
                          await run(`invites/${r.id}`, { action: "revoke" });
                          notify("success", "Invitation revoked.");
                          invites.reload();
                        } catch (err) {
                          notify("error", errorMessage(err));
                        }
                      }}
                    >
                      Revoke
                    </button>
                  ) : null
                }
              />
            )}
          </SectionCard>
        )}
      </div>
      <InviteDialog open={inviting} onClose={() => setInviting(false)} onDone={() => invites.reload()} />
      <MemberAdminDialog
        key={managing?.userId ?? "none"}
        member={managing}
        onClose={() => setManaging(null)}
        onDone={() => members.reload()}
      />
    </>
  );
}
