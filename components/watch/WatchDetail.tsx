"use client";

// One Global Watch item: what it is, why it matters, links, files, and the
// actions this viewer may take (author / moderator; the API decides).
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Archive, ExternalLink, FileText, MessagesSquare, Pencil, RotateCcw, Trash2, Upload } from "lucide-react";
import { ApiError, apiFetch, errorMessage, type WatchItemDetailDto } from "@/components/fund/api";
import { safeHttpUrl } from "@/components/fund/common";
import { TextAreaField } from "@/components/fund/forms";
import { Modal } from "@/components/fund/overlays";
import { ErrorState, LoadingSkeleton, btnDanger, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { ProofDropzone, formatBytes, prepareProofFile, proofFileProblem, readFileBase64 } from "@/components/fund/upload";
import { APPROVAL_SENT, ApprovalNotice } from "@/components/fund/workflow";
import { CategoryTag, LINK_ICON, LINK_KIND_LABEL, relativeDate } from "@/components/watch/shared";

function Notice({ tone, children }: { tone: "ok" | "error"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-md border px-3 py-2 text-[13.5px] ${
        tone === "error" ? "border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 text-[var(--qf-down)]" : "border-[var(--qf-fix)]/30 bg-[var(--qf-fix-bg)] text-[var(--qf-ink)]"
      }`}
    >
      {children}
    </p>
  );
}

export function WatchDetail({ id }: { id: number }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [item, setItem] = useState<WatchItemDetailDto | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(sp.get("sent") === "1" ? { tone: "ok", text: APPROVAL_SENT } : null);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ item: WatchItemDetailDto }>(`/api/qfinera/watch/${id}`)
      .then((r) => setItem(r.item))
      .catch((err: unknown) => setLoadError(err instanceof ApiError ? err : new ApiError("ERROR", errorMessage(err), 0)));
  }, [id]);
  useEffect(load, [load]);

  async function act(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await apiFetch<{ pendingApproval?: true; status?: string }>(`/api/qfinera/watch/${id}`, { body });
      if (r.pendingApproval) setMessage({ tone: "ok", text: APPROVAL_SENT });
      else if (body.action === "delete") return router.push("/qfinera/watch");
      else setMessage({ tone: "ok", text: done });
      setDeleting(false);
      load();
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-[var(--qf-line)]">
        <ErrorState error={loadError.status === 404 ? "This item does not exist, or it was removed." : loadError} />
        <p className="pb-6 text-center">
          <Link href="/qfinera/watch" className="text-[14px] font-semibold text-[var(--qf-brass-dark)] hover:underline">
            Back to Global Watch
          </Link>
        </p>
      </div>
    );
  }
  if (!item) return <LoadingSkeleton label="Loading" rows={6} />;

  const subject = [item.symbol && `${item.symbol}${item.exchange ? ` · ${item.exchange}` : ""}`, item.company ?? item.instrumentName, item.industry].filter(Boolean);
  const images = item.attachments.filter((a) => a.contentType.startsWith("image/"));
  const docs = item.attachments.filter((a) => !a.contentType.startsWith("image/"));
  const fileUrl = (attId: number) => `/api/qfinera/watch/${item.id}/attachments/${attId}`;

  return (
    <article className="space-y-6">
      <Link href="/qfinera/watch" className="inline-flex items-center gap-1.5 text-[13px] text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]">
        <ArrowLeft size={14} aria-hidden="true" /> Global Watch
      </Link>

      <header className="space-y-3 border-b border-[var(--qf-line)] pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryTag category={item.category} />
          {item.priority === "HIGH" && <span className="text-[12px] font-semibold text-[var(--qf-ink)]">High priority</span>}
          {item.status === "ARCHIVED" && <span className="rounded-full border border-[var(--qf-line)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--qf-ink-soft)]">Archived</span>}
        </div>
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[36px]">{item.title}</h1>
        {subject.length > 0 && <p className="text-[14.5px] font-medium text-[var(--qf-ink-soft)]">{subject.join(" · ")}</p>}
        <p className="text-[13px] text-[var(--qf-ink-soft)]">
          Shared by <span className="font-semibold text-[var(--qf-ink)]">{item.authorName ?? "a member"}</span> · <time dateTime={item.createdAt}>{relativeDate(item.createdAt)}</time>
          {item.updatedAt !== item.createdAt && (
            <>
              {" "}
              · updated {relativeDate(item.updatedAt)}
              {item.updatedByName && item.updatedByName !== item.authorName ? ` by ${item.updatedByName}` : ""}
            </>
          )}
        </p>
      </header>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      {item.pendingRequests > 0 && <Notice tone="ok">A moderator&apos;s change to this item is waiting for administrator approval.</Notice>}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <p className="text-[17px] leading-relaxed text-[var(--qf-ink)]">{item.summary}</p>
          {item.details && <div className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--qf-ink)]">{item.details}</div>}

          {item.links.length > 0 && (
            <section aria-labelledby="links-h">
              <h2 id="links-h" className="font-display text-[17px] font-semibold text-[var(--qf-ink)]">
                Links
              </h2>
              <ul className="mt-3 space-y-2">
                {item.links.map((l) => {
                  const href = safeHttpUrl(l.url);
                  const Icon = LINK_ICON[l.kind as keyof typeof LINK_ICON] ?? LINK_ICON.OTHER;
                  return (
                    <li key={l.url}>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="group flex items-center gap-3 rounded-lg border border-[var(--qf-line)] px-3.5 py-3 transition-colors hover:border-[var(--qf-brass)]"
                        >
                          <Icon size={17} className="shrink-0 text-[var(--qf-brass-dark)]" aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-[var(--qf-ink)]">{l.label ?? new URL(href).hostname}</span>
                            <span className="block truncate text-[12px] text-[var(--qf-ink-soft)]">
                              {LINK_KIND_LABEL[l.kind] ?? "Link"} · {new URL(href).hostname}
                            </span>
                          </span>
                          <ExternalLink size={14} className="shrink-0 text-[var(--qf-ink-soft)]" aria-hidden="true" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {(images.length > 0 || docs.length > 0 || item.can.edit === "direct") && (
            <section aria-labelledby="files-h">
              <h2 id="files-h" className="font-display text-[17px] font-semibold text-[var(--qf-ink)]">
                Files
              </h2>
              {images.length > 0 && (
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {images.map((a) => (
                    <li key={a.id}>
                      <a href={fileUrl(a.id)} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border border-[var(--qf-line)] hover:border-[var(--qf-brass)]">
                        {/* eslint-disable-next-line @next/next/no-img-element -- private, authenticated file; not for the image optimizer */}
                        <img src={fileUrl(a.id)} alt={a.fileName} loading="lazy" className="aspect-[4/3] w-full bg-[var(--qf-cream-1)] object-cover" />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {docs.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {docs.map((a) => (
                    <li key={a.id}>
                      <a href={fileUrl(a.id)} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-lg border border-[var(--qf-line)] px-3.5 py-2.5 hover:border-[var(--qf-brass)]">
                        <FileText size={16} className="text-[var(--qf-brass-dark)]" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-[14px]">{a.fileName}</span>
                        <span className="text-[12px] text-[var(--qf-ink-soft)]">{formatBytes(a.sizeBytes)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {item.can.edit === "direct" && item.attachments.length < 6 && (
                <div className="mt-3 space-y-2">
                  <ProofDropzone label="Add a screenshot or PDF (up to 2 MB)" file={file} onChange={setFile} disabled={busy} />
                  {file && (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={busy || Boolean(proofFileProblem(file))}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await apiFetch(`/api/qfinera/watch/${item.id}/attachments`, { body: { fileName: file.name, data: await readFileBase64(await prepareProofFile(file)) } });
                          setFile(null);
                          load();
                        } catch (err) {
                          setMessage({ tone: "error", text: errorMessage(err) });
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <Upload size={15} aria-hidden="true" /> Upload
                    </button>
                  )}
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {(item.source || item.contact || item.tags.length > 0) && (
            <dl className="space-y-3 rounded-xl border border-[var(--qf-line)] p-4 text-[13.5px]">
              {item.source && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Source</dt>
                  <dd className="mt-0.5 break-words">{item.source}</dd>
                </div>
              )}
              {item.contact && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Point of contact</dt>
                  <dd className="mt-0.5 break-words">{item.contact}</dd>
                </div>
              )}
              {item.tags.length > 0 && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Tags</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {item.tags.map((t) => (
                      <Link key={t} href={`/qfinera/watch?q=${encodeURIComponent(t)}`} className="rounded border border-[var(--qf-line)] px-1.5 py-0.5 text-[12px] hover:border-[var(--qf-brass)]">
                        #{t}
                      </Link>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {(item.can.edit !== "deny" || item.can.archive !== "deny" || item.can.delete !== "deny") && (
            <div className="space-y-2 rounded-xl border border-[var(--qf-line)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">{item.can.isOwner ? "Your item" : "Moderation"}</p>
              {item.can.edit !== "deny" && (
                <Link href={`/qfinera/watch/${item.id}/edit`} className={`${btnSecondary} w-full`}>
                  <Pencil size={15} aria-hidden="true" /> {item.can.edit === "propose" ? "Suggest an edit" : "Edit"}
                </Link>
              )}
              {item.can.archive !== "deny" &&
                (item.status === "ARCHIVED" ? (
                  <button type="button" className={`${btnSecondary} w-full`} disabled={busy} onClick={() => void act({ action: "restore" }, "Restored to the feed.")}>
                    <RotateCcw size={15} aria-hidden="true" /> Restore to feed
                  </button>
                ) : (
                  <button type="button" className={`${btnSecondary} w-full`} disabled={busy} onClick={() => void act({ action: "archive" }, "Archived: hidden from the feed.")}>
                    <Archive size={15} aria-hidden="true" /> Archive
                  </button>
                ))}
              {item.can.delete !== "deny" && (
                <button type="button" className={`${btnDanger} w-full`} onClick={() => setDeleting(true)}>
                  <Trash2 size={15} aria-hidden="true" /> {item.can.delete === "propose" ? "Request deletion" : "Delete"}
                </button>
              )}
            </div>
          )}

          <Link
            href="/qfinera/community"
            className="group flex items-start gap-3 rounded-xl border border-[var(--qf-line)] p-4 transition-colors hover:border-[var(--qf-brass)]"
          >
            <MessagesSquare size={18} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" aria-hidden="true" />
            <span>
              <span className="block font-semibold text-[var(--qf-ink)]">Discuss this</span>
              <span className="block text-[13px] text-[var(--qf-ink-soft)]">Ask questions or share a view in Community.</span>
            </span>
            <ArrowRight size={15} className="ml-auto mt-1 shrink-0 text-[var(--qf-ink-soft)]" aria-hidden="true" />
          </Link>
          <p className="text-[12px] leading-relaxed text-[var(--qf-ink-soft)]">Shared by a member for information only. Not investment advice; check the source yourself.</p>
        </aside>
      </div>

      <Modal open={deleting} onClose={() => setDeleting(false)} title={item.can.delete === "propose" ? "Request deletion?" : "Delete this item?"}>
        <div className="space-y-4 px-5 py-4 text-[14px]">
          {item.can.delete === "propose" && <ApprovalNotice />}
          <p className="text-[13.5px] text-[var(--qf-ink-soft)]">It disappears from Global Watch for everyone. A record is kept in the audit log.</p>
          <TextAreaField
            label={item.can.delete === "propose" ? "Reason (required, shown to the administrator)" : "Reason (optional)"}
            value={reason}
            onChange={setReason}
            maxLength={500}
            rows={2}
          />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--qf-line)] px-5 py-3 sm:flex-row sm:justify-end">
          <button type="button" className={btnSecondary} onClick={() => setDeleting(false)} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={item.can.delete === "propose" ? btnPrimary : btnDanger}
            disabled={busy || (item.can.delete === "propose" && reason.trim().length < 3)}
            onClick={() => void act({ action: "delete", reason: reason.trim() || undefined }, "Deleted.")}
          >
            {busy ? "Working…" : item.can.delete === "propose" ? "Send for approval" : "Delete"}
          </button>
        </div>
      </Modal>
    </article>
  );
}
