"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { errorMessage, type Settings } from "@/components/fund/api";
import { NoAccess, resourceState } from "@/components/fund/common";
import { DateDisplay } from "@/components/fund/display";
import { SelectField, TextAreaField, TextField } from "@/components/fund/forms";
import { useNotice } from "@/components/fund/notices";
import { Modal } from "@/components/fund/overlays";
import { Disclaimer, PageHeader, SectionCard, btnDanger, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useAuthority, useCan, useFund } from "@/components/fund/session";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { APPROVAL_SENT, ApprovalNotice, isPendingApproval } from "@/components/fund/workflow";

function SettingsForm({ initial, onSaved }: { initial: Settings; onSaved: () => void }) {
  const authority = useAuthority()("settings:manage");
  const editable = authority !== null;
  const proposing = authority === "propose";
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [name, setName] = useState(initial.fund.name);
  const [description, setDescription] = useState(initial.fund.description ?? "");
  const [cutoff, setCutoff] = useState(initial.nav.cutoffTimeIst);
  const [holidays, setHolidays] = useState(initial.nav.holidays.join("\n"));
  const [stcg, setStcg] = useState(initial.taxAssumptions.stcgRate);
  const [ltcg, setLtcg] = useState(initial.taxAssumptions.ltcgRate);
  const [provider, setProvider] = useState(initial.marketDataProvider);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setFields({});
        // Send only what changed, so the audit log and any approval request show the real change.
        const holidayList = holidays.split(/[\s,]+/).map((h) => h.trim()).filter(Boolean);
        const patch: Record<string, unknown> = {};
        if (name !== initial.fund.name) patch.name = name;
        if ((description.trim() || null) !== (initial.fund.description ?? null)) patch.description = description.trim() || null;
        if (cutoff !== initial.nav.cutoffTimeIst) patch.cutoffTimeIst = cutoff;
        if (JSON.stringify([...new Set(holidayList)].sort()) !== JSON.stringify(initial.nav.holidays)) patch.holidays = holidayList;
        if (stcg !== initial.taxAssumptions.stcgRate) patch.stcgRate = stcg;
        if (ltcg !== initial.taxAssumptions.ltcgRate) patch.ltcgRate = ltcg;
        if (provider !== initial.marketDataProvider) patch.marketDataProvider = provider;
        if (Object.keys(patch).length === 0) {
          setError("Nothing has changed.");
          return;
        }
        try {
          const result = await run("settings", patch, "PATCH");
          notify("success", isPendingApproval(result) ? APPROVAL_SENT : "Settings saved.");
          onSaved();
        } catch (err) {
          setError(errorMessage(err));
          setFields((err as { fields?: Record<string, string> }).fields ?? {});
        }
      }}
    >
      <fieldset disabled={!editable || pending} className="space-y-6">
        <SectionCard title="Pool">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" value={name} onChange={setName} required maxLength={120} error={fields.name} />
            <TextField label="Currency" value={initial.fund.currency} onChange={() => {}} disabled hint={`Initial NAV ₹${initial.fund.initialNav}; fixed.`} />
          </div>
          <div className="mt-4">
            <TextAreaField label="Description" value={description} onChange={setDescription} maxLength={1000} />
          </div>
        </SectionCard>
        <SectionCard title="NAV timing" description="Applies to requests confirmed or approved from now on. A request already waiting keeps its NAV date.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Cutoff time (IST, HH:MM)" value={cutoff} onChange={setCutoff} maxLength={5} error={fields.cutoffTimeIst} hint="At or before the cutoff on a trading day: that day's NAV. Otherwise the next trading day's." />
            <TextAreaField label="Market holidays (YYYY-MM-DD, one per line)" value={holidays} onChange={setHolidays} rows={5} error={fields.holidays} />
          </div>
        </SectionCard>
        <SectionCard title="Tax estimate assumptions" description="Used only for the informational tax estimate report. Never affects NAV or units.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Short-term gains rate (%)" value={stcg} onChange={setStcg} maxLength={6} error={fields.stcgRate} />
            <TextField label="Long-term gains rate (%)" value={ltcg} onChange={setLtcg} maxLength={6} error={fields.ltcgRate} />
          </div>
        </SectionCard>
        <SectionCard title="Market data">
          <SelectField
            label="Price source"
            value={provider}
            onChange={setProvider}
            options={initial.supportedProviders.map((p) => ({ value: p, label: p === "manual" ? "Recorded prices (entered manually)" : p }))}
            hint="QFinera has no live market feed. Prices are recorded by the pool, labelled with their date, and official NAVs use recorded closing prices."
          />
        </SectionCard>
      </fieldset>
      {error && (
        <p role="alert" className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]">
          {error}
        </p>
      )}
      {editable && (
        <div className="space-y-3">
          {proposing && <ApprovalNotice />}
          <button type="submit" className={btnPrimary} disabled={pending}>
            {proposing ? "Send changes for approval" : "Save settings"}
          </button>
        </div>
      )}
      {initial.updatedAt && (
        <p className="text-[12.5px] text-[var(--qf-ink-soft)]">
          Last changed <DateDisplay value={initial.updatedAt} /> by {initial.updatedByName ?? "an administrator"}.
        </p>
      )}
    </form>
  );
}

/** Delete the pool: typed-name confirmation, 30-day retention, restorable by an admin until then. */
function DangerZone({ poolName }: { poolName: string }) {
  const authority = useAuthority()("pool:delete");
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (authority === null) return null;
  const proposing = authority === "propose";
  const matches = typed.trim() === poolName.trim();

  return (
    <SectionCard title="Delete this pool" description="For a group that has wound up. Nothing is erased straight away.">
      <div className="space-y-3 text-[14px]">
        <ul className="list-disc space-y-1 pl-5 text-[13.5px] text-[var(--qf-ink-soft)]">
          <li>The pool disappears for every member at once, and open invites and requests are closed.</li>
          <li>All records are kept for 30 days. An admin can restore the pool from the Pools page during that time.</li>
          <li>After 30 days the pool and all its records are permanently deleted. This cannot be undone.</li>
        </ul>
        <button type="button" className={btnDanger} onClick={() => setOpen(true)}>
          <AlertTriangle size={15} aria-hidden="true" /> {proposing ? "Request deletion" : "Delete pool"}
        </button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={`Delete “${poolName}”?`}>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!matches) return;
            setError(null);
            try {
              const result = await run("deletion", { confirmName: typed, reason: reason.trim() || undefined });
              if (isPendingApproval(result)) {
                notify("success", APPROVAL_SENT);
                setOpen(false);
              } else {
                router.push("/qfinera/pools?deleted=1");
              }
            } catch (err) {
              setError(errorMessage(err));
            }
          }}
        >
          <div className="space-y-4 px-5 py-4 text-[14px]">
            {proposing && <ApprovalNotice />}
            <p className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-ink)]">
              Every member loses access immediately. The pool is permanently deleted after 30 days unless an admin restores it.
            </p>
            <TextField label={`Type the pool name to confirm: ${poolName}`} value={typed} onChange={setTyped} maxLength={120} />
            <TextField label="Reason (optional, recorded in the audit log)" value={reason} onChange={setReason} maxLength={500} />
            {error && (
              <p role="alert" className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]">
                {error}
              </p>
            )}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-[var(--qf-line)] px-5 py-3 sm:flex-row sm:justify-end">
            <button type="button" className={btnSecondary} onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className={btnDanger} disabled={pending || !matches}>
              {pending ? "Working…" : proposing ? "Send for approval" : "Delete pool"}
            </button>
          </div>
        </form>
      </Modal>
    </SectionCard>
  );
}

export function SettingsView() {
  const can = useCan();
  const { poolName } = useFund();
  const res = usePoolResource<{ settings: Settings }>(can("settings:view") ? "settings" : null);
  if (!can("settings:view")) return <NoAccess what="Pool settings" />;
  const state = resourceState(res, "settings");
  return (
    <>
      <PageHeader title="Settings" description="Changes are recorded in the audit log with their before and after values." />
      <div className="mb-6">
        <Disclaimer>
          This pool is private and invite-only. Public participation, custody of money, fees or advice are not available and cannot be switched on
          here; they would need a separate legal and regulatory review first.
        </Disclaimer>
      </div>
      {state ? <SectionCard flush>{state}</SectionCard> : res.data ? <SettingsForm key={res.data.settings.updatedAt ?? "new"} initial={res.data.settings} onSaved={res.reload} /> : null}
      <div className="mt-10">
        <DangerZone poolName={poolName} />
      </div>
    </>
  );
}
