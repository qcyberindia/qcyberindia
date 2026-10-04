"use client";

// Create or edit a Global Watch item. Only the essentials are required
// (title, summary, category); everything else is optional and progressive.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { apiFetch, errorMessage, type InstrumentDto, type WatchItemDetailDto } from "@/components/fund/api";
import { SelectField, TextAreaField, TextField, inputClass } from "@/components/fund/forms";
import { btnPrimary, btnSecondary } from "@/components/fund/parts";
import { ProofDropzone, proofFileProblem, readFileBase64 } from "@/components/fund/upload";
import { ApprovalNotice } from "@/components/fund/workflow";
import { CATEGORIES, CATEGORY_HINT, CATEGORY_LABEL, LINK_KIND_LABEL } from "@/components/watch/shared";

type Link_ = { url: string; label: string; kind: string };

function InstrumentSearch({ value, onChange }: { value: InstrumentDto | null; onChange: (i: InstrumentDto | null) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<InstrumentDto[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      apiFetch<{ instruments: InstrumentDto[] }>("/api/qfinera/watch/instruments", { query: { q: q.trim() }, signal: controller.signal })
        .then((r) => setResults(r.instruments))
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--qf-brass)]/50 bg-[var(--qf-brass)]/5 px-3 py-2 text-[14px]">
        <span className="min-w-0 truncate">
          <strong>{value.symbol}</strong> · {value.exchange}
          {value.name ? <span className="text-[var(--qf-ink-soft)]"> · {value.name}</span> : null}
        </span>
        <button type="button" onClick={() => onChange(null)} aria-label="Remove listed company" className="rounded p-1 hover:bg-[var(--qf-cream-1)]">
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <label htmlFor="watch-instrument" className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
        Listed company (optional)
      </label>
      <input
        id="watch-instrument"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search NSE/BSE symbol or name"
        className={`${inputClass} mt-1.5`}
        autoComplete="off"
        role="combobox"
        aria-expanded={results.length > 0 && q.trim().length >= 2}
        aria-controls="watch-instrument-list"
      />
      {results.length > 0 && q.trim().length >= 2 && (
        <ul id="watch-instrument-list" role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] shadow-lg">
          {results.map((i) => (
            <li key={i.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[14px] hover:bg-[var(--qf-cream-1)] focus:bg-[var(--qf-cream-1)] focus:outline-none"
                onClick={() => {
                  onChange(i);
                  setQ("");
                  setResults([]);
                }}
              >
                <strong>{i.symbol}</strong> · {i.exchange} <span className="text-[var(--qf-ink-soft)]">{i.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WatchForm({ item, proposing = false }: { item?: WatchItemDetailDto; proposing?: boolean }) {
  const router = useRouter();
  const editing = Boolean(item);
  const [title, setTitle] = useState(item?.title ?? "");
  const [summary, setSummary] = useState(item?.summary ?? "");
  const [details, setDetails] = useState(item?.details ?? "");
  const [category, setCategory] = useState(item?.category ?? "STOCK");
  const [instrument, setInstrument] = useState<InstrumentDto | null>(
    item?.instrumentId ? { id: item.instrumentId, symbol: item.symbol ?? "", exchange: (item.exchange ?? "NSE") as InstrumentDto["exchange"], name: item.instrumentName } : null
  );
  const [company, setCompany] = useState(item?.company ?? "");
  const [industry, setIndustry] = useState(item?.industry ?? "");
  const [tags, setTags] = useState((item?.tags ?? []).join(", "));
  const [links, setLinks] = useState<Link_[]>(item?.links.map((l) => ({ url: l.url, label: l.label ?? "", kind: l.kind })) ?? []);
  const [source, setSource] = useState(item?.source ?? "");
  const [contact, setContact] = useState(item?.contact ?? "");
  const [priority, setPriority] = useState(item?.priority ?? "NORMAL");
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [more, setMore] = useState(editing && Boolean(item?.details || item?.source || item?.contact || item?.industry));

  async function submit() {
    setError(null);
    setFields({});
    const bad = files.map(proofFileProblem).find(Boolean);
    if (bad) return setError(bad);
    const body = {
      title: title.trim(),
      summary: summary.trim(),
      details: details.trim() || null,
      category,
      instrumentId: instrument?.id ?? null,
      symbol: null,
      company: company.trim() || null,
      industry: industry.trim() || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      links: links.filter((l) => l.url.trim()).map((l) => ({ url: l.url.trim(), label: l.label.trim() || null, kind: l.kind })),
      source: source.trim() || null,
      contact: contact.trim() || null,
      priority,
      ...(proposing ? { reason: reason.trim() || null } : {}),
    };
    setPending(true);
    try {
      if (editing && item) {
        const r = await apiFetch<{ pendingApproval?: true }>(`/api/qfinera/watch/${item.id}`, { method: "PATCH", body });
        router.push(`/qfinera/watch/${item.id}${r.pendingApproval ? "?sent=1" : ""}`);
      } else {
        const r = await apiFetch<{ item: { id: number } }>("/api/qfinera/watch", { body });
        for (const f of files) {
          await apiFetch(`/api/qfinera/watch/${r.item.id}/attachments`, { body: { fileName: f.name, data: await readFileBase64(f) } });
        }
        router.push(`/qfinera/watch/${r.item.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setFields((err as { fields?: Record<string, string> }).fields ?? {});
      setPending(false);
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending) void submit();
      }}
    >
      {proposing && <ApprovalNotice />}
      <section className="space-y-4 rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4 sm:p-5">
        <TextField label="Title" value={title} onChange={setTitle} required maxLength={160} error={fields.title} placeholder="e.g. Tata Steel announces new capacity in Odisha" />
        <TextAreaField
          label="What happened, in a few lines"
          value={summary}
          onChange={setSummary}
          required
          maxLength={400}
          rows={3}
          error={fields.summary}
          hint="Shown on the card. Say why it matters."
        />
        <fieldset>
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Category</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((c) => (
              <label
                key={c}
                className={`cursor-pointer rounded-md border px-3 py-2 text-[13px] transition-colors ${
                  category === c ? "border-[var(--qf-brass)] bg-[var(--qf-brass)]/8" : "border-[var(--qf-line)] hover:border-[var(--qf-brass)]/60"
                }`}
              >
                <input type="radio" name="category" value={c} checked={category === c} onChange={() => setCategory(c as typeof category)} className="sr-only" />
                <span className="block font-semibold text-[var(--qf-ink)]">{CATEGORY_LABEL[c]}</span>
                <span className="block text-[11.5px] leading-snug text-[var(--qf-ink-soft)]">{CATEGORY_HINT[c]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="space-y-4 rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4 sm:p-5">
        <h2 className="font-display text-[16px] font-semibold text-[var(--qf-ink)]">What it is about</h2>
        <InstrumentSearch value={instrument} onChange={setInstrument} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Company (if not listed above)" value={company} onChange={setCompany} maxLength={160} />
          <TextField label="Tags (comma separated)" value={tags} onChange={setTags} maxLength={300} hint="e.g. capex, steel, results" error={fields.tags} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[16px] font-semibold text-[var(--qf-ink)]">Links and videos</h2>
          <button
            type="button"
            className={btnSecondary}
            disabled={links.length >= 10}
            onClick={() => setLinks([...links, { url: "", label: "", kind: "ARTICLE" }])}
          >
            <Plus size={15} aria-hidden="true" /> Add link
          </button>
        </div>
        {links.length === 0 && <p className="text-[13px] text-[var(--qf-ink-soft)]">Add the article, filing, video or presentation it comes from.</p>}
        {fields.links && <p className="text-[13px] text-[var(--qf-down)]">{fields.links}</p>}
        <ul className="space-y-3">
          {links.map((l, i) => (
            <li key={i} className="grid gap-2 rounded-md border border-[var(--qf-line)] p-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
              <TextField label={`Link ${i + 1} address`} type="url" value={l.url} onChange={(v) => setLinks(links.map((x, k) => (k === i ? { ...x, url: v } : x)))} maxLength={500} placeholder="https://" />
              <SelectField
                label="Type"
                value={l.kind}
                onChange={(v) => setLinks(links.map((x, k) => (k === i ? { ...x, kind: v } : x)))}
                options={Object.entries(LINK_KIND_LABEL).map(([value, label]) => ({ value, label }))}
              />
              <button type="button" onClick={() => setLinks(links.filter((_, k) => k !== i))} className={`${btnSecondary} sm:mb-0`} aria-label={`Remove link ${i + 1}`}>
                <Trash2 size={15} aria-hidden="true" />
              </button>
              <div className="sm:col-span-3">
                <TextField label="Label (optional)" value={l.label} onChange={(v) => setLinks(links.map((x, k) => (k === i ? { ...x, label: v } : x)))} maxLength={120} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {!editing && (
        <section className="space-y-3 rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4 sm:p-5">
          <h2 className="font-display text-[16px] font-semibold text-[var(--qf-ink)]">Screenshots and documents</h2>
          <ProofDropzone
            label="Add a file (PNG, JPEG, WebP or PDF, up to 2 MB)"
            file={null}
            onChange={(f) => f && files.length < 6 && setFiles([...files, f])}
            hint="Up to 6 files. Visible to signed-in QFinera members."
          />
          {files.length > 0 && (
            <ul className="space-y-1.5 text-[13.5px]">
              {files.map((f, i) => (
                <li key={`${f.name}${i}`} className="flex items-center justify-between gap-2 rounded border border-[var(--qf-line)] px-3 py-1.5">
                  <span className="min-w-0 truncate">{f.name}</span>
                  <button type="button" onClick={() => setFiles(files.filter((_, k) => k !== i))} aria-label={`Remove ${f.name}`} className="rounded p-1 hover:bg-[var(--qf-cream-1)]">
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4 sm:p-5">
        <button type="button" className="text-[14px] font-semibold text-[var(--qf-brass-dark)] hover:underline" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? "Hide" : "Add"} details, source and contact
        </button>
        {more && (
          <div className="mt-4 space-y-4">
            <TextAreaField label="Detailed notes, observations or thesis" value={details} onChange={setDetails} maxLength={10000} rows={6} error={fields.details} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Industry" value={industry} onChange={setIndustry} maxLength={120} />
              <TextField label="Source" value={source} onChange={setSource} maxLength={200} hint="e.g. BSE filing, company call, newspaper" />
              <TextField label="Point of contact (optional)" value={contact} onChange={setContact} maxLength={200} hint="Only share what the person agreed to share." />
              <SelectField
                label="Priority"
                value={priority}
                onChange={(v) => setPriority(v as typeof priority)}
                options={[
                  { value: "LOW", label: "Low" },
                  { value: "NORMAL", label: "Normal" },
                  { value: "HIGH", label: "High" },
                ]}
              />
            </div>
          </div>
        )}
      </section>

      {proposing && <TextAreaField label="Reason for the change (shown to the administrator)" value={reason} onChange={setReason} maxLength={500} rows={2} />}

      <p className="text-[12.5px] text-[var(--qf-ink-soft)]">
        Global Watch is for sharing information, not tips. Do not post buy/sell calls, price targets or anything you are not allowed to share.
      </p>

      {error && (
        <p role="alert" className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href={item ? `/qfinera/watch/${item.id}` : "/qfinera/watch"} className={btnSecondary}>
          Cancel
        </Link>
        <button type="submit" className={btnPrimary} disabled={pending || title.trim().length < 3 || summary.trim().length < 10}>
          {pending ? "Saving…" : proposing ? "Send for approval" : editing ? "Save changes" : "Publish"}
        </button>
      </div>
    </form>
  );
}
