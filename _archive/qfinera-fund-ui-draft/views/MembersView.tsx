"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import {
  ApiError,
  endpoints,
  itemOf,
  listOf,
  type ContributionDto,
  type FundRole,
  type MemberDto,
  type WithdrawalDto,
} from "@/components/fund/api";
import { DateDisplay, MoneyDisplay, PercentDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { humanize } from "@/components/fund/format";
import { SelectField, TextField, inputClass } from "@/components/fund/forms";
import { FormDialog } from "@/components/fund/overlays";
import { EmptyState, PageHeader, SectionCard, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useNotice } from "@/components/fund/notices";
import { useCan, useFund } from "@/components/fund/session";
import { useFundMutation, useFundResource } from "@/components/fund/useResource";
import { FUND_BASE, recordHref } from "@/components/fund/nav";
import { NoAccess, resourceState } from "@/components/fund/common";
import { StickyAction } from "@/components/fund/shell";
import { DataTable, FilterBar, FilterField, Pagination, SearchInput } from "@/components/fund/table";
import { ApprovalPanel, DetailGrid, type WorkflowAction } from "@/components/fund/workflow";
import { contributionColumns, memberColumns, withdrawalColumns } from "@/components/fund/views/columns";

const PAGE_SIZE = 25;
const ROLE_OPTIONS = [
  { value: "MEMBER", label: "Member" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Administrator" },
] as const;

/** Invite roles the signed-in person may offer. The server enforces the same rule. */
function invitableRoles(role: FundRole) {
  return role === "ADMIN" ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r.value === "MEMBER");
}

function InviteDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { role } = useFund();
  const { run, pending } = useFundMutation();
  const { notify } = useNotice();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("MEMBER");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const local: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) local.email = "Enter a valid email address.";
    setFieldErrors(local);
    if (Object.keys(local).length > 0) return;
    setError(null);
    try {
      await run(endpoints.members, { body: { email: email.trim(), role: inviteRole } });
      notify("success", `Invitation sent to ${email.trim()}.`);
      setEmail("");
      onClose();
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fields ?? {});
        setError(err.message);
      } else setError("Something went wrong. Please try again.");
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Invite a member"
      description="They receive an invitation and join with the role you choose."
      submitLabel="Send invitation"
      pending={pending}
      error={error}
      onSubmit={submit}
    >
      <TextField label="Email address" type="email" required value={email} onChange={setEmail} error={fieldErrors.email} maxLength={254} />
      <SelectField label="Role" value={inviteRole} onChange={setInviteRole} options={invitableRoles(role)} error={fieldErrors.role} />
    </FormDialog>
  );
}

export function MembersView() {
  const { userId } = useFund();
  const can = useCan();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const allowed = can("members:view_all");

  const res = useFundResource(
    allowed ? endpoints.members : null,
    { page, pageSize: PAGE_SIZE, q, role: roleFilter, status: statusFilter },
    (json) => listOf<MemberDto>(json)
  );
  const state = allowed ? resourceState(res, "members") : null;
  const list = res.data;
  const dirty = Boolean(q || roleFilter || statusFilter);

  function reset() {
    setQ("");
    setRoleFilter("");
    setStatusFilter("");
    setPage(1);
  }

  const invite = can("members:invite") ? (
    <button type="button" className={btnPrimary} onClick={() => setInviteOpen(true)}>
      <Plus size={15} aria-hidden="true" /> Invite member
    </button>
  ) : null;

  return (
    <>
      <PageHeader title="Members" description="Who is in the fund, their units and ownership." actions={invite ? <div className="hidden lg:block">{invite}</div> : undefined} />

      {!allowed ? (
        <SectionCard>
          <EmptyState
            title="Your membership"
            description="Administrators and managers can see every member. You can view your own holdings in the fund."
            action={
              <Link className={btnSecondary} href={recordHref("members", userId)}>
                View my membership
              </Link>
            }
          />
        </SectionCard>
      ) : (
        <>
          <FilterBar dirty={dirty} onReset={reset}>
            <SearchInput key={q} label="Search members" placeholder="Name" applied={q} onSearch={(v) => { setQ(v); setPage(1); }} />
            <FilterField label="Role">
              {(id) => (
                <select id={id} className={inputClass} value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
                  <option value="">All roles</option>
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              )}
            </FilterField>
            <FilterField label="Status">
              {(id) => (
                <select id={id} className={inputClass} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              )}
            </FilterField>
          </FilterBar>

          <SectionCard flush>
            {state ?? (list && list.items.length > 0 ? (
              <>
                <DataTable columns={memberColumns} rows={list.items} rowKey={(r) => r.user_id} rowHref={(r) => recordHref("members", r.user_id)} caption="Fund members" />
                <Pagination page={page} pageSize={PAGE_SIZE} total={list.total} count={list.items.length} onPage={setPage} />
              </>
            ) : (
              <EmptyState title={dirty ? "No members match these filters" : "No members yet"} description={dirty ? "Try clearing a filter." : "Invited members appear here."} />
            ))}
          </SectionCard>
        </>
      )}

      {invite && <StickyAction>{invite}</StickyAction>}
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} onDone={res.reload} />
    </>
  );
}

function RoleDialog({ member, open, onClose, onDone }: { member: MemberDto; open: boolean; onClose: () => void; onDone: () => void }) {
  const { run, pending } = useFundMutation();
  const { notify } = useNotice();
  const [role, setRole] = useState<string>(member.role);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await run(endpoints.action(endpoints.members, member.user_id, "role"), { body: { role } });
      notify("success", `${member.display_name} is now ${humanize(role).toLowerCase()}.`);
      onClose();
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <FormDialog open={open} onClose={onClose} title="Change role" description={`Role for ${member.display_name}. This is recorded in the audit log.`} submitLabel="Save role" pending={pending} error={error} onSubmit={submit}>
      <SelectField label="Role" value={role} onChange={setRole} options={ROLE_OPTIONS} />
    </FormDialog>
  );
}

function MemberRecords({ memberId }: { memberId: number }) {
  const c = useFundResource(endpoints.contributions, { member: memberId, pageSize: 5 }, (j) => listOf<ContributionDto>(j));
  const w = useFundResource(endpoints.withdrawals, { member: memberId, pageSize: 5 }, (j) => listOf<WithdrawalDto>(j));
  const cState = resourceState(c, "contributions");
  const wState = resourceState(w, "withdrawals");
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <SectionCard title="Contributions" flush>
        {cState ?? (c.data && c.data.items.length > 0 ? (
          <DataTable columns={contributionColumns(false)} rows={c.data.items} rowKey={(r) => r.id} rowHref={(r) => recordHref("contributions", r.id)} caption="Member contributions" />
        ) : (
          <EmptyState title="No contributions" />
        ))}
      </SectionCard>
      <SectionCard title="Withdrawals" flush>
        {wState ?? (w.data && w.data.items.length > 0 ? (
          <DataTable columns={withdrawalColumns(false)} rows={w.data.items} rowKey={(r) => r.id} rowHref={(r) => recordHref("withdrawals", r.id)} caption="Member withdrawals" />
        ) : (
          <EmptyState title="No withdrawals" />
        ))}
      </SectionCard>
    </div>
  );
}

export function MemberDetailView({ id }: { id: number }) {
  const { userId, fundName } = useFund();
  const can = useCan();
  const [roleOpen, setRoleOpen] = useState(false);
  const res = useFundResource(`${endpoints.members}/${id}`, {}, (json) => itemOf<MemberDto>(json));
  const state = resourceState(res, "member");
  const m = res.data;
  const isSelf = m?.user_id === userId;
  const canSee = can("members:view_all") || (can("members:view_self") && id === userId);

  const actions: WorkflowAction[] = [];
  if (m && !isSelf && can("members:suspend")) {
    if (m.status === "active") {
      actions.push({
        key: "suspend",
        label: "Suspend member",
        title: `Suspend ${m.display_name}?`,
        consequences: "They lose access to the fund immediately. Their units and history are kept. You can reactivate them later.",
        variant: "danger",
        reasonLabel: "Reason for suspension",
        success: `${m.display_name} was suspended.`,
      });
    } else {
      actions.push({
        key: "reactivate",
        label: "Reactivate member",
        title: `Reactivate ${m.display_name}?`,
        consequences: "They regain access with their current role.",
        variant: "primary",
        reasonLabel: "Reason for reactivation",
        success: `${m.display_name} was reactivated.`,
      });
    }
  }

  return (
    <>
      <p className="mb-3 text-[13px]">
        <Link className="text-[var(--qf-brass-dark)] underline underline-offset-2" href={`${FUND_BASE}/members`}>
          &larr; All members
        </Link>
      </p>
      {!canSee ? (
        <NoAccess what="This member record" />
      ) : state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !m ? (
        <SectionCard><EmptyState title="Member not found" /></SectionCard>
      ) : (
        <div className="space-y-6">
          <PageHeader
            title={m.display_name}
            description={`${humanize(m.role)} of ${fundName}`}
            actions={
              <>
                <StatusBadge status={m.status} />
                {can("members:change_role") && !isSelf && (
                  <button type="button" className={btnSecondary} onClick={() => setRoleOpen(true)}>Change role</button>
                )}
              </>
            }
          />
          <SectionCard title="Holding in the fund">
            <DetailGrid
              items={[
                { label: "Role", value: humanize(m.role) },
                { label: "Status", value: <StatusBadge status={m.status} /> },
                { label: "Joined", value: <DateDisplay value={m.joined_at} /> },
                { label: "Contributed capital", value: <MoneyDisplay value={m.contributed_capital} /> },
                { label: "Units", value: <QuantityDisplay value={m.units} /> },
                { label: "Current value", value: <MoneyDisplay value={m.current_value} /> },
                { label: "Ownership", value: <PercentDisplay value={m.ownership_percent} /> },
                { label: "Last activity", value: <DateDisplay value={m.last_activity_at} /> },
              ]}
            />
          </SectionCard>
          {can("members:suspend") && !isSelf && (
            <ApprovalPanel heading="Membership" basePath={endpoints.members} id={m.user_id} actions={actions} onDone={res.reload} />
          )}
          <MemberRecords memberId={m.user_id} />
          <RoleDialog key={m.role} member={m} open={roleOpen} onClose={() => setRoleOpen(false)} onDone={res.reload} />
        </div>
      )}
    </>
  );
}
