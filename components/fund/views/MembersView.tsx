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
import { EmptyState, PageHeader, SectionCard, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable } from "@/components/fund/table";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";

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
        options={(role === "ADMIN" ? ["MEMBER", "MANAGER", "ADMIN"] : ["MEMBER"]).map((r) => ({ value: r, label: humanize(r) }))}
        hint="Managers record trades and expenses; administrators approve money movements and manage the pool."
      />
    </FormDialog>
  );
}

function MemberAdminDialog({ member, onClose, onDone }: { member: Member | null; onClose: () => void; onDone: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [role, setRole] = useState(member?.role ?? "MEMBER");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>, success: string) {
    if (!member) return;
    setError(null);
    try {
      await run(`members/${member.userId}`, { ...body, reason: reason.trim() || undefined }, "PATCH");
      notify("success", success);
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Modal open={member !== null} onClose={onClose} title={member ? `Manage ${member.name}` : ""}>
      {member && (
        <div className="space-y-4 px-5 py-4 text-[14px]">
          <SelectField
            label="Role"
            value={role}
            onChange={setRole}
            options={["MEMBER", "MANAGER", "ADMIN"].map((r) => ({ value: r, label: humanize(r) }))}
          />
          <TextField label="Reason (recorded in the audit log)" value={reason} onChange={setReason} maxLength={500} />
          {error && (
            <p role="alert" className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={pending || role === member.role} onClick={() => void send({ role }, "Role updated.")}>
              Save role
            </button>
            {member.status === "active" ? (
              <button type="button" className={btnSecondary} disabled={pending} onClick={() => void send({ status: "suspended" }, "Member suspended.")}>
                Suspend access
              </button>
            ) : (
              <button type="button" className={btnSecondary} disabled={pending} onClick={() => void send({ status: "active" }, "Member reactivated.")}>
                Reactivate
              </button>
            )}
            <button type="button" className={btnSecondary} disabled={pending} onClick={() => void send({ status: "removed" }, "Member removed.")}>
              Remove from pool
            </button>
          </div>
          <p className="text-[12.5px] text-[var(--qf-ink-soft)]">
            Suspension blocks access but keeps units. Removal needs zero units and no open requests; their history is kept.
          </p>
        </div>
      )}
    </Modal>
  );
}

export function MembersView() {
  const can = useCan();
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
                { key: "r", header: "Role", cell: (r) => humanize(r.role) },
                { key: "s", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
                { key: "j", header: "Joined", cell: (r) => <DateDisplay value={r.joinedAt} /> },
                { key: "i", header: "Contributed", align: "right", cell: (r) => <MoneyDisplay value={r.invested} /> },
                { key: "u", header: "Units", align: "right", cell: (r) => <QuantityDisplay value={r.units} /> },
                { key: "v", header: "Value (official NAV)", align: "right", cell: (r) => <MoneyDisplay value={r.currentValue} /> },
                { key: "o", header: "Ownership", align: "right", cell: (r) => <PercentDisplay value={r.ownershipPercent} /> },
              ]}
              rowAction={
                can("members:change_role")
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
                  { key: "r", header: "Role", cell: (r) => humanize(r.role) },
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
