"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Plus } from "lucide-react";
import {
  ApiError,
  endpoints,
  itemOf,
  listOf,
  type WatchlistCommentDto,
  type WatchlistItemDto,
} from "@/components/fund/api";
import { DateDisplay, MoneyDisplay, PercentDisplay, QualityBadge, StatusBadge } from "@/components/fund/display";
import { humanize } from "@/components/fund/format";
import { SelectField, TextAreaField, TextField } from "@/components/fund/forms";
import { ConfirmDialog, FormDialog } from "@/components/fund/overlays";
import { EmptyState, PageHeader, SectionCard, btnDanger, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useNotice } from "@/components/fund/notices";
import { useCan } from "@/components/fund/session";
import { useFundMutation, useFundResource } from "@/components/fund/useResource";
import { FUND_BASE, recordHref } from "@/components/fund/nav";
import { resourceState, safeHttpUrl } from "@/components/fund/common";
import { StickyAction } from "@/components/fund/shell";
import { DataTable, type Column } from "@/components/fund/table";
import { DetailGrid } from "@/components/fund/workflow";
import { InstrumentSelect } from "@/components/fund/views/InstrumentSelect";

const STATUS_OPTIONS = ["IDEA", "WATCHING", "ACTIVE", "INVALIDATED", "COMPLETED"].map((s) => ({ value: s, label: humanize(s) }));

function PriceCell({ item }: { item: WatchlistItemDto }) {
  return (
    <span className="flex flex-col items-end gap-1">
      <MoneyDisplay value={item.price} dp={2} />
      <QualityBadge quality={item.price_quality} />
    </span>
  );
}

function ChangeCell({ item }: { item: WatchlistItemDto }) {
  return (
    <span className="flex flex-col items-end">
      <MoneyDisplay value={item.daily_change} signed />
      <PercentDisplay value={item.daily_change_percent} signed className="text-[12px]" />
    </span>
  );
}

function AddItemDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { run, pending } = useFundMutation();
  const { notify } = useNotice();
  const [instrumentId, setInstrumentId] = useState("");
  const [title, setTitle] = useState("");
  const [thesis, setThesis] = useState("");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const local: Record<string, string> = {};
    if (!instrumentId) local.instrumentId = "Choose an instrument.";
    if (!title.trim()) local.title = "Give this idea a short title.";
    if (url.trim() && !safeHttpUrl(url.trim())) local.researchUrl = "Enter a full web address starting with http:// or https://.";
    setErrors(local);
    if (Object.keys(local).length > 0) return;
    setError(null);
    try {
      await run(endpoints.watchlist, {
        body: {
          instrumentId: Number(instrumentId),
          title: title.trim(),
          thesis: thesis.trim() || null,
          notes: notes.trim() || null,
          researchUrl: url.trim() || null,
        },
      });
      notify("success", "Added to the watchlist.");
      setInstrumentId("");
      setTitle("");
      setThesis("");
      setNotes("");
      setUrl("");
      onClose();
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? {});
        setError(err.message);
      } else setError("Something went wrong. Please try again.");
    }
  }

  return (
    <FormDialog open={open} onClose={onClose} title="Add to watchlist" description="Track an instrument you are researching." submitLabel="Add to watchlist" pending={pending} error={error} onSubmit={submit}>
      <InstrumentSelect required value={instrumentId} onChange={setInstrumentId} error={errors.instrumentId} />
      <TextField label="Title" required value={title} onChange={setTitle} maxLength={120} error={errors.title} />
      <TextAreaField label="Thesis" value={thesis} onChange={setThesis} maxLength={1000} hint="Why you are watching it." error={errors.thesis} />
      <TextAreaField label="Notes" value={notes} onChange={setNotes} maxLength={500} error={errors.notes} />
      <TextField label="Research reference" type="url" value={url} onChange={setUrl} maxLength={500} hint="A link to your research, if any." error={errors.researchUrl} />
    </FormDialog>
  );
}

export function WatchlistView() {
  const can = useCan();
  const { run, pending } = useFundMutation();
  const { notify } = useNotice();
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<WatchlistItemDto | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const res = useFundResource(endpoints.watchlist, {}, (j) => listOf<WatchlistItemDto>(j));
  const state = resourceState(res, "watchlist");
  const items = res.data?.items ?? [];
  const write = can("watchlist:write");

  const columns: Column<WatchlistItemDto>[] = [
    {
      key: "title",
      header: "Idea",
      primary: true,
      cell: (r) => (
        <span>
          {r.title}
          <span className="block text-[12px] font-normal text-[var(--qf-ink-soft)]">{r.symbol}</span>
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
    { key: "price", header: "Price", align: "right", cell: (r) => <PriceCell item={r} /> },
    { key: "change", header: "Daily change", align: "right", cell: (r) => <ChangeCell item={r} /> },
    { key: "notes", header: "Notes", cell: (r) => (r.notes ? <span className="line-clamp-2">{r.notes}</span> : "\u2014") },
    { key: "comments", header: "Comments", align: "right", cell: (r) => r.comment_count ?? 0 },
  ];

  async function confirmRemove() {
    if (!removing) return;
    setRemoveError(null);
    try {
      await run(`${endpoints.watchlist}/${encodeURIComponent(String(removing.id))}`, { method: "DELETE" });
      notify("success", `${removing.title} was removed from the watchlist.`);
      setRemoving(null);
      res.reload();
    } catch (err) {
      setRemoveError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  const add = write ? (
    <button type="button" className={btnPrimary} onClick={() => setOpen(true)}>
      <Plus size={15} aria-hidden="true" /> Add instrument
    </button>
  ) : null;

  return (
    <>
      <PageHeader title="Watchlist" description="Instruments the fund is researching, with the thinking behind each." actions={add ? <div className="hidden lg:block">{add}</div> : undefined} />
      <SectionCard flush>
        {state ?? (items.length > 0 ? (
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(r) => r.id}
            rowHref={(r) => recordHref("watchlist", r.id)}
            caption="Watchlist"
            rowAction={write ? (r) => (
              <button type="button" className={btnSecondary} onClick={() => { setRemoveError(null); setRemoving(r); }} aria-label={`Remove ${r.title}`}>
                Remove
              </button>
            ) : undefined}
          />
        ) : (
          <EmptyState title="Nothing on the watchlist yet" description="Add an instrument to start tracking it." action={add ?? undefined} />
        ))}
      </SectionCard>
      {add && <StickyAction>{add}</StickyAction>}
      <AddItemDialog open={open} onClose={() => setOpen(false)} onDone={res.reload} />
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.title ?? "this idea"}?`}
        consequences="It disappears from the watchlist for everyone in the fund. Its comments go with it."
        confirmLabel="Remove"
        destructive
        pending={pending}
        error={removeError}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}

function Comments({ itemId }: { itemId: number }) {
  const can = useCan();
  const { run, pending } = useFundMutation();
  const { notify } = useNotice();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const path = `${endpoints.watchlist}/${encodeURIComponent(String(itemId))}/comments`;
  const res = useFundResource(path, {}, (j) => listOf<WatchlistCommentDto>(j));
  const state = resourceState(res, "comments");
  const items = res.data?.items ?? [];

  async function post() {
    if (!body.trim()) {
      setError("Write a comment first.");
      return;
    }
    setError(null);
    try {
      await run(path, { body: { body: body.trim() } });
      notify("success", "Comment added.");
      setBody("");
      res.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <SectionCard title="Comments" description="Discussion among fund members.">
      {state ?? (items.length > 0 ? (
        <ul className="divide-y divide-[var(--qf-line)]">
          {items.map((c) => (
            <li key={c.id} className="py-3">
              <p className="text-[13px] text-[var(--qf-ink-soft)]">
                <span className="font-semibold text-[var(--qf-ink)]">{c.author_name}</span> &middot; <DateDisplay value={c.created_at} />
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[14px] text-[var(--qf-ink)]">{c.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No comments yet" description="Start the discussion." />
      ))}
      {can("watchlist:comment") && (
        <form
          className="mt-4 space-y-3 border-t border-[var(--qf-line)] pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!pending) void post();
          }}
        >
          <TextAreaField label="Add a comment" value={body} onChange={setBody} maxLength={1000} error={error} disabled={pending} />
          <button type="submit" className={btnPrimary} disabled={pending}>
            {pending ? "Posting\u2026" : "Post comment"}
          </button>
        </form>
      )}
    </SectionCard>
  );
}

export function WatchlistDetailView({ id }: { id: number }) {
  const router = useRouter();
  const can = useCan();
  const { run, pending } = useFundMutation();
  const { notify } = useNotice();
  const [status, setStatus] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = `${endpoints.watchlist}/${encodeURIComponent(String(id))}`;
  const res = useFundResource(path, {}, (j) => itemOf<WatchlistItemDto>(j));
  const state = resourceState(res, "watchlist item");
  const item = res.data;
  const write = can("watchlist:write");
  const link = safeHttpUrl(item?.research_url);

  async function saveStatus() {
    if (!item || status === null || status === item.status) return;
    setError(null);
    try {
      await run(path, { method: "PATCH", body: { status } });
      notify("success", "Status updated.");
      setStatus(null);
      res.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  async function remove() {
    setError(null);
    try {
      await run(path, { method: "DELETE" });
      notify("success", "Removed from the watchlist.");
      router.push(`${FUND_BASE}/watchlist`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <p className="mb-3 text-[13px]">
        <Link className="text-[var(--qf-brass-dark)] underline underline-offset-2" href={`${FUND_BASE}/watchlist`}>&larr; Watchlist</Link>
      </p>
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !item ? (
        <SectionCard><EmptyState title="Idea not found" /></SectionCard>
      ) : (
        <div className="space-y-6">
          <PageHeader
            title={item.title}
            description={item.symbol}
            actions={
              <>
                <StatusBadge status={item.status} />
                {write && <button type="button" className={btnDanger} onClick={() => { setError(null); setConfirmOpen(true); }}>Remove</button>}
              </>
            }
          />
          <SectionCard title="Market">
            <DetailGrid
              items={[
                { label: "Price", value: <MoneyDisplay value={item.price} /> },
                { label: "Price status", value: <QualityBadge quality={item.price_quality} /> },
                { label: "Daily change", value: <MoneyDisplay value={item.daily_change} signed /> },
                { label: "Daily change %", value: <PercentDisplay value={item.daily_change_percent} signed /> },
              ]}
            />
          </SectionCard>
          <SectionCard title="Research">
            <DetailGrid
              items={[
                { label: "Thesis", value: item.thesis ? <span className="whitespace-pre-wrap">{item.thesis}</span> : "None written" },
                { label: "Notes", value: item.notes ? <span className="whitespace-pre-wrap">{item.notes}</span> : "None" },
                {
                  label: "Research reference",
                  value: link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--qf-brass-dark)] underline underline-offset-2">
                      Open research <ExternalLink size={13} aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : item.research_url ? "Not a valid web link" : "None",
                },
                { label: "Added", value: <DateDisplay value={item.created_at} /> },
              ]}
            />
          </SectionCard>
          {write && (
            <SectionCard title="Status">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="sm:w-64">
                  <SelectField label="Status" value={status ?? item.status} onChange={setStatus} options={STATUS_OPTIONS} />
                </div>
                <button type="button" className={btnSecondary} disabled={pending || status === null || status === item.status} onClick={() => void saveStatus()}>
                  {pending ? "Saving\u2026" : "Save status"}
                </button>
              </div>
              {error && <p role="alert" className="mt-3 text-[13px] text-[var(--qf-down)]">{error}</p>}
            </SectionCard>
          )}
          <Comments itemId={item.id} />
          <ConfirmDialog
            open={confirmOpen}
            title={`Remove ${item.title}?`}
            consequences="It disappears from the watchlist for everyone in the fund. Its comments go with it."
            confirmLabel="Remove"
            destructive
            pending={pending}
            error={error}
            onConfirm={() => void remove()}
            onCancel={() => setConfirmOpen(false)}
          />
        </div>
      )}
    </>
  );
}
