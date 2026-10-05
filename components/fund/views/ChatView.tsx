"use client";

// Pool Chat: the pool's private conversation. Every active member, VIEWER
// included, reads and posts. Messages are plain text rendered by React (never
// as HTML) in the server's order. New messages arrive by polling the latest
// page every few seconds while the tab is visible: there is no live push, and
// the page says so ("Updated …").
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2, MessagesSquare, Pencil, Send, Trash2 } from "lucide-react";
import { ApiError, apiFetch, errorMessage, poolApi, type ChatMessageDto, type ChatPageDto } from "@/components/fund/api";
import { TextAreaField, inputClass } from "@/components/fund/forms";
import { formatCalendarDate, humanize } from "@/components/fund/format";
import { useNotice } from "@/components/fund/notices";
import { FormDialog } from "@/components/fund/overlays";
import { EmptyState, LoadingSkeleton, PageHeader, SectionCard, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";

const POLL_MS = 8000;
const MAX_CHARS = 2000;

type Msg = ChatMessageDto;

const istDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));
const istTime = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(iso));

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Merges server messages into the current list by id (server order), newest copy wins. */
function merge(current: Msg[], incoming: Msg[]): Msg[] {
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function MessageRow({
  m,
  mine,
  canModerate,
  onChanged,
  onRemove,
}: {
  m: Msg;
  mine: boolean;
  canModerate: boolean;
  onChanged: (m: Msg) => void;
  onRemove: (m: Msg) => void;
}) {
  const { poolId } = useFund();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<{ message: Msg }>(poolApi(poolId, `chat/${m.id}`), { body: { action: "edit", body: draft } });
      onChanged(r.message);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="group flex gap-3 px-4 py-2.5 sm:px-5">
      <span
        aria-hidden="true"
        className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
          mine ? "bg-[var(--qf-brass)]/20 text-[var(--qf-brass-dark)]" : "bg-[var(--qf-cream-2)] text-[var(--qf-ink)]"
        }`}
      >
        {initials(m.authorName)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
          <span className="font-semibold text-[var(--qf-ink)]">{mine ? `${m.authorName} (you)` : m.authorName}</span>
          {m.authorRole && <span className="text-[11px] uppercase tracking-wide text-[var(--qf-ink-soft)]">{humanize(m.authorRole)}</span>}
          <time dateTime={m.createdAt} className="text-[12px] text-[var(--qf-ink-soft)]" title={`${formatCalendarDate(istDay(m.createdAt))}, ${istTime(m.createdAt)} IST`}>
            {istTime(m.createdAt)}
          </time>
          {m.editedAt && !m.deleted && <span className="text-[12px] text-[var(--qf-ink-soft)]">(edited)</span>}
        </p>
        {m.deleted ? (
          <p className="mt-0.5 text-[13.5px] italic text-[var(--qf-ink-soft)]">
            {m.removedByModerator ? "This message was removed by an administrator." : "This message was deleted."}
          </p>
        ) : editing ? (
          <div className="mt-1 space-y-2">
            <label className="sr-only" htmlFor={`edit-${m.id}`}>Edit message</label>
            <textarea
              id={`edit-${m.id}`}
              className={`${inputClass} min-h-20`}
              value={draft}
              maxLength={MAX_CHARS}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void save();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              disabled={busy}
            />
            {error && <p role="alert" className="text-[12.5px] text-[var(--qf-down)]">{error}</p>}
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} disabled={busy || !draft.trim()} onClick={() => void save()}>
                {busy && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />} Save
              </button>
              <button type="button" className={btnSecondary} disabled={busy} onClick={() => { setEditing(false); setDraft(m.body); setError(null); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          // Plain text: React escapes it, so markup is shown, never run.
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--qf-ink)]">{m.body}</p>
        )}
      </div>
      {!m.deleted && !editing && (mine || canModerate) && (
        <div className="flex shrink-0 items-start gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {mine && (
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--qf-ink-soft)] hover:bg-[var(--qf-cream-1)] hover:text-[var(--qf-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]"
              aria-label="Edit message"
              onClick={() => { setDraft(m.body); setEditing(true); }}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--qf-ink-soft)] hover:bg-[var(--qf-down)]/10 hover:text-[var(--qf-down)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]"
            aria-label={mine ? "Delete message" : "Remove message"}
            onClick={() => onRemove(m)}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </li>
  );
}

function RemoveDialog({ m, mine, onClose, onRemoved }: { m: Msg | null; mine: boolean; onClose: () => void; onRemoved: (m: Msg) => void }) {
  const { poolId } = useFund();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <FormDialog
      open={m !== null}
      onClose={onClose}
      title={mine ? "Delete your message?" : "Remove this message?"}
      description={
        mine
          ? "It is replaced by “This message was deleted.” for everyone."
          : "It is replaced by “removed by an administrator” for everyone. The removal and your reason are recorded in the audit log."
      }
      submitLabel={mine ? "Delete" : "Remove"}
      pending={pending}
      error={error}
      onSubmit={async () => {
        if (!m) return;
        setPending(true);
        setError(null);
        try {
          const r = await apiFetch<{ message: Msg }>(poolApi(poolId, `chat/${m.id}`), {
            body: { action: "remove", ...(mine ? {} : { reason: reason.trim() }) },
          });
          onRemoved(r.message);
          onClose();
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setPending(false);
        }
      }}
    >
      {m && <p className="whitespace-pre-wrap break-words rounded-md bg-[var(--qf-cream-1)] px-3 py-2 text-[13.5px]">{m.body}</p>}
      {!mine && <TextAreaField label="Reason" value={reason} onChange={setReason} maxLength={500} rows={2} required />}
    </FormDialog>
  );
}

export function ChatView() {
  const { poolId, userId } = useFund();
  const can = useCan();
  const { notify } = useNotice();
  const canPost = can("chat:post");
  const canModerate = can("chat:moderate");

  const [messages, setMessages] = useState<Msg[]>([]);
  const [hasOlder, setHasOlder] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const [draft, setDraft] = useState("");
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Msg | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const keepOffset = useRef<number | null>(null);
  const firstLoad = useRef(true);

  const fetchLatest = useCallback(
    async (signal?: AbortSignal) => {
      const page = await apiFetch<ChatPageDto>(poolApi(poolId, "chat"), { signal });
      setMessages((cur) => merge(cur, page.messages));
      if (firstLoad.current) {
        setHasOlder(page.hasOlder);
        firstLoad.current = false;
      }
      setLoaded(true);
      setLoadError(null);
      setLastSync(new Date());
    },
    [poolId]
  );

  // Initial load, then poll while the tab is visible.
  useEffect(() => {
    const controller = new AbortController();
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      fetchLatest(controller.signal).catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(err instanceof ApiError ? err.message : errorMessage(err));
      });
    };
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [fetchLatest]);

  // Keep the view pinned to the newest message unless the reader scrolled up;
  // when older messages are prepended, keep the reader's place.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await apiFetch<ChatPageDto>(poolApi(poolId, "chat"), { query: { before: oldest.id } });
      const el = scroller.current;
      keepOffset.current = el ? el.scrollHeight - el.scrollTop : null;
      setMessages((cur) => merge(cur, page.messages));
      setHasOlder(page.hasOlder);
    } catch (err) {
      notify("error", errorMessage(err));
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sendState === "sending") return;
    setSendState("sending");
    setSendError(null);
    try {
      const r = await apiFetch<{ message: Msg }>(poolApi(poolId, "chat"), { body: { body } });
      stickToBottom.current = true;
      setMessages((cur) => merge(cur, [r.message]));
      setDraft("");
      setSendState("sent");
    } catch (err) {
      // The draft is kept so nothing typed is lost.
      setSendError(errorMessage(err));
      setSendState("failed");
    }
  };

  const upsert = (m: Msg) => setMessages((cur) => merge(cur, [m]));

  // Day separators in IST.
  const rows: Array<{ day: string } | { msg: Msg }> = [];
  let lastDay = "";
  for (const m of messages) {
    const d = istDay(m.createdAt);
    if (d !== lastDay) {
      rows.push({ day: d });
      lastDay = d;
    }
    rows.push({ msg: m });
  }

  return (
    <>
      <PageHeader title="Pool Chat" description="Discuss this Pool with other participants. Only members of this pool can see this conversation." />
      <SectionCard flush>
        <div className="flex h-[min(70vh,calc(100dvh-16rem))] min-h-[22rem] flex-col">
          <div
            ref={scroller}
            className="flex-1 overflow-y-auto overscroll-contain"
            onScroll={(e) => {
              const el = e.currentTarget;
              stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            aria-live="polite"
            aria-relevant="additions"
            aria-busy={!loaded}
          >
            {!loaded ? (
              loadError ? (
                <p role="alert" className="p-5 text-[14px] text-[var(--qf-down)]">Could not load the chat: {loadError}</p>
              ) : (
                <LoadingSkeleton label="Loading messages" />
              )
            ) : messages.length === 0 ? (
              <EmptyState
                icon={MessagesSquare}
                title="Start the conversation."
                description="Discuss trades, the portfolio, Fund updates, or anything relevant to this Pool."
              />
            ) : (
              <>
                {hasOlder && (
                  <div className="flex justify-center px-4 pt-4">
                    <button type="button" className={btnSecondary} onClick={() => void loadOlder()} disabled={loadingOlder}>
                      {loadingOlder && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                      Load older messages
                    </button>
                  </div>
                )}
                <ul className="py-2" aria-label="Messages">
                  {rows.map((r) =>
                    "day" in r ? (
                      <li key={`d${r.day}`} className="flex items-center gap-3 px-4 py-2 sm:px-5" aria-hidden="true">
                        <span className="h-px flex-1 bg-[var(--qf-line)]" />
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--qf-ink-soft)]">{formatCalendarDate(r.day)}</span>
                        <span className="h-px flex-1 bg-[var(--qf-line)]" />
                      </li>
                    ) : (
                      <MessageRow
                        key={r.msg.id}
                        m={r.msg}
                        mine={r.msg.userId === userId}
                        canModerate={canModerate}
                        onChanged={upsert}
                        onRemove={setRemoving}
                      />
                    )
                  )}
                </ul>
              </>
            )}
          </div>

          <div className="border-t border-[var(--qf-line)] p-3 sm:p-4">
            {canPost ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="flex items-end gap-2"
              >
                <label htmlFor="pool-chat-composer" className="sr-only">Message</label>
                <textarea
                  id="pool-chat-composer"
                  className={`${inputClass} max-h-40 min-h-11 flex-1 resize-none`}
                  rows={Math.min(6, Math.max(1, draft.split("\n").length))}
                  placeholder="What would you like to discuss?"
                  value={draft}
                  maxLength={MAX_CHARS}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (sendState !== "sending") setSendState("idle");
                  }}
                  onKeyDown={(e) => {
                    // Enter sends; Shift+Enter is a new line; never mid-IME composition.
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  aria-describedby="pool-chat-status"
                />
                <button type="submit" className={`${btnPrimary} min-h-11`} disabled={sendState === "sending" || !draft.trim()}>
                  {sendState === "sending" ? (
                    <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <Send size={16} aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">Send</span>
                  <span className="sr-only sm:hidden">Send</span>
                </button>
              </form>
            ) : (
              <p className="text-[13px] text-[var(--qf-ink-soft)]">You cannot post in this chat.</p>
            )}
            <p id="pool-chat-status" className="mt-1.5 flex flex-wrap justify-between gap-2 text-[12px] text-[var(--qf-ink-soft)]">
              <span role={sendState === "failed" ? "alert" : undefined} className={sendState === "failed" ? "text-[var(--qf-down)]" : undefined}>
                {sendState === "sending"
                  ? "Sending…"
                  : sendState === "sent"
                    ? "Sent."
                    : sendState === "failed"
                      ? `Not sent: ${sendError ?? "please try again."}`
                      : "Enter to send · Shift + Enter for a new line"}
              </span>
              <span>
                {loadError && loaded ? "Could not refresh. Retrying…" : lastSync ? `Checks for new messages every ${POLL_MS / 1000} s` : ""}
                {draft.length > MAX_CHARS - 200 ? ` · ${MAX_CHARS - draft.length} characters left` : ""}
              </span>
            </p>
          </div>
        </div>
      </SectionCard>
      <RemoveDialog
        key={removing?.id ?? "none"}
        m={removing}
        mine={removing?.userId === userId}
        onClose={() => setRemoving(null)}
        onRemoved={upsert}
      />
    </>
  );
}
