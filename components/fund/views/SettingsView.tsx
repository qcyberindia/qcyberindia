"use client";

import { useState } from "react";
import { errorMessage, type Settings } from "@/components/fund/api";
import { NoAccess, resourceState } from "@/components/fund/common";
import { DateDisplay } from "@/components/fund/display";
import { SelectField, TextAreaField, TextField } from "@/components/fund/forms";
import { useNotice } from "@/components/fund/notices";
import { Disclaimer, PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";
import { useCan } from "@/components/fund/session";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";

function SettingsForm({ initial, onSaved }: { initial: Settings; onSaved: () => void }) {
  const can = useCan();
  const editable = can("settings:manage");
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
        try {
          await run(
            "settings",
            {
              name,
              description: description.trim() || null,
              cutoffTimeIst: cutoff,
              holidays: holidays.split(/[\s,]+/).map((h) => h.trim()).filter(Boolean),
              stcgRate: stcg,
              ltcgRate: ltcg,
              marketDataProvider: provider,
            },
            "PATCH"
          );
          notify("success", "Settings saved.");
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
            options={initial.supportedProviders.map((p) => ({ value: p, label: p === "manual" ? "Recorded prices (entered by an administrator)" : p }))}
            hint="Quotes are display-only and labelled by quality. Official NAVs use recorded closing prices."
          />
        </SectionCard>
      </fieldset>
      {error && (
        <p role="alert" className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]">
          {error}
        </p>
      )}
      {editable && (
        <button type="submit" className={btnPrimary} disabled={pending}>
          Save settings
        </button>
      )}
      {initial.updatedAt && (
        <p className="text-[12.5px] text-[var(--qf-ink-soft)]">
          Last changed <DateDisplay value={initial.updatedAt} /> by {initial.updatedByName ?? "an administrator"}.
        </p>
      )}
    </form>
  );
}

export function SettingsView() {
  const can = useCan();
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
    </>
  );
}
