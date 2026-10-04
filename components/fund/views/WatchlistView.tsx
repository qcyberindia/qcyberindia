"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { errorMessage, type InstrumentDto, type WatchItem } from "@/components/fund/api";
import { resourceState } from "@/components/fund/common";
import { DateDisplay, MoneyDisplay, QualityBadge, StatusBadge } from "@/components/fund/display";
import { SelectField, TextAreaField, TextField, inputClass, SegmentedField } from "@/components/fund/forms";
import { humanize } from "@/components/fund/format";
import { recordHref } from "@/components/fund/nav";
import { useNotice } from "@/components/fund/notices";
import { FormDialog } from "@/components/fund/overlays";
import { Disclaimer, EmptyState, PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";
import { DataTable, FilterBar, FilterField } from "@/components/fund/table";
import { usePoolMutation, usePoolResource } from "@/components/fund/useResource";
import { InstrumentPicker, type InstrumentKind } from "@/components/fund/views/shared";

export const WATCH_STATUSES = ["IDEA", "WATCHING", "ACTIVE", "INVALIDATED", "COMPLETED"];

function NewItem({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { run, pending } = usePoolMutation();
  const { notify } = useNotice();
  const [kind, setKind] = useState<InstrumentKind>("EQUITY");
  const [instrument, setInstrument] = useState<InstrumentDto | null>(null);
  const [title, setTitle] = useState("");
  const [thesis, setThesis] = useState("");
  const [researchUrl, setResearchUrl] = useState("");
  const [status, setStatus] = useState("IDEA");
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Add to watchlist"
      description="Shared research notes for the pool's own discussion. Not a recommendation."
      submitLabel="Add"
      pending={pending}
      error={error}
      onSubmit={async () => {
        setError(null);
        if (!instrument) return setError("Choose an instrument.");
        try {
          await run("watchlist", { instrumentId: instrument.id, title, thesis: thesis || undefined, researchUrl: researchUrl || undefined, status });
          notify("success", "Added to the watchlist.");
          onDone();
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        }
      }}
    >
      <SegmentedField<InstrumentKind>
        label="Instrument type"
        value={kind}
        onChange={(k) => {
          setKind(k);
          setInstrument(null);
        }}
        options={[
          { value: "EQUITY", label: "Equity" },
          { value: "FUTURE", label: "Future" },
          { value: "OPTION", label: "Option" },
        ]}
      />
      <InstrumentPicker key={kind} kind={kind} value={instrument} onChange={setInstrument} />
      <TextField label="Title" value={title} onChange={setTitle} required maxLength={140} />
      <TextAreaField label="Research notes" value={thesis} onChange={setThesis} maxLength={4000} rows={4} />
      <TextField label="Research link" type="url" value={researchUrl} onChange={setResearchUrl} maxLength={500} hint="Optional http(s) link." />
      <SelectField label="Stage" value={status} onChange={setStatus} options={WATCH_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} />
    </FormDialog>
  );
}

export function WatchlistView() {
  const can = useCan();
  const { poolId } = useFund();
  const [status, setStatus] = useState("");
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const res = usePoolResource<{ watchlist: WatchItem[] }>("watchlist", { status, archived: archived ? 1 : null });
  const state = resourceState(res, "the watchlist");
  const rows = res.data?.watchlist ?? [];

  return (
    <>
      <PageHeader
        title="Watchlist"
        description="The pool's shared research notes and discussion."
        actions={
          can("watchlist:write") || can("watchlist:create") ? (
            <button type="button" className={btnPrimary} onClick={() => setCreating(true)}>
              <Plus size={16} aria-hidden="true" /> Add instrument
            </button>
          ) : undefined
        }
      />
      <div className="mb-4">
        <Disclaimer>Watchlist notes are members&rsquo; own research and discussion. They are not investment advice, recommendations or signals.</Disclaimer>
      </div>
      <FilterBar dirty={status !== "" || archived} onReset={() => { setStatus(""); setArchived(false); }}>
        <FilterField label="Stage">
          {(id) => (
            <select id={id} className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {WATCH_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </select>
          )}
        </FilterField>
        <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Archived
        </label>
      </FilterBar>
      <SectionCard flush>
        {state ??
          (rows.length === 0 ? (
            <EmptyState title="Nothing on the watchlist" />
          ) : (
            <DataTable
              caption="Watchlist"
              rows={rows}
              rowKey={(r) => r.id}
              rowHref={(r) => recordHref(poolId, "watchlist", r.id)}
              columns={[
                { key: "t", header: "Item", primary: true, cell: (r) => r.title },
                { key: "i", header: "Instrument", cell: (r) => `${r.symbol}${r.exchange ? ` · ${r.exchange}` : ""}` },
                { key: "s", header: "Stage", cell: (r) => <StatusBadge status={r.status} /> },
                {
                  key: "p",
                  header: "Price",
                  align: "right",
                  cell: (r) =>
                    r.quote?.available ? (
                      <span className="flex flex-col items-end gap-1">
                        <MoneyDisplay value={r.quote.price} dp={4} />
                        <QualityBadge quality={r.quote.quality} stale={r.quote.stale} />
                      </span>
                    ) : (
                      <QualityBadge quality="UNAVAILABLE" />
                    ),
                },
                { key: "c", header: "Comments", align: "right", cell: (r) => r.commentCount },
                { key: "u", header: "Updated", cell: (r) => <DateDisplay value={r.updatedAt} /> },
              ]}
            />
          ))}
      </SectionCard>
      {(can("watchlist:write") || can("watchlist:create")) && <NewItem key={String(creating)} open={creating} onClose={() => setCreating(false)} onDone={res.reload} />}
    </>
  );
}
