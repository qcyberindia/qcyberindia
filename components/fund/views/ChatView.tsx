"use client";

// Pool Chat: the pool's private conversation. Every active member, VIEWER
// included, reads and posts. Messages are plain text rendered by React (never
// as HTML) in the server's order. New messages arrive by polling the latest
// page every few seconds while the tab is visible: there is no live push, and
// the page says so ("Updates every 8 seconds").
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Lock, Pencil, Send, Trash2 } from "lucide-react";
import { ApiError, apiFetch, errorMessage, poolApi, type ChatMessageDto, type ChatPageDto } from "@/components/fund/api";
import { TextAreaField, inputClass } from "@/components/fund/forms";
import { formatCalendarDate, humanize } from "@/components/fund/format";
import { useNotice } from "@/components/fund/notices";
import { FormDialog } from "@/components/fund/overlays";
import { poolBase } from "@/components/fund/nav";
import { LoadingSkeleton, PageHeader, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { useCan, useFund } from "@/components/fund/session";

const POLL_MS = 8000;
const MAX_CHARS = 2000;

type Msg = ChatMessageDto;

const istDay = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(iso));
const istTime = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(iso));

/** "Today", "Yesterday", or the calendar date (IST). */
function dayLabel(day: string): string {
  const today = istDay(new Date().toISOString());
  const yesterday = istDay(new Date(Date.now() - 86_400_000).toISOString());
  return day === today ? "Today" : day === yesterday ? "Yesterday" : formatCalendarDate(day);
}

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

/** Consecutive messages by one author within this window share a header. */
const GROUP_MS = 5 * 60 * 1000;

function MessageRow({
  m,
  mine,
  continued,
  canModerate,
  onChanged,
  onRemove,
}: {
  m: Msg;
  mine: boolean;
  /** Same author as the message just above, moments later: no repeated header. */
  continued: boolean;
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

  const time = (
    <time dateTime={m.createdAt} className="text-[11.5px] text-[var(--qf-ink-soft)]" title={`${formatCalendarDate(istDay(m.createdAt))}, ${istTime(m.createdAt)} IST`}>
      {istTime(m.createdAt)}
    </time>
  );
  const tools = !m.deleted && !editing && (mine || canModerate) && (
    <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
      {mine && (
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--qf-ink-soft)] hover:bg-[var(--qf-cream-2)] hover:text-[var(--qf-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)] sm:h-7 sm:w-7"
          aria-label="Edit message"
          onClick={() => { setDraft(m.body); setEditing(true); }}
        >
          <Pencil size={13} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--qf-ink-soft)] hover:bg-[var(--qf-down)]/10 hover:text-[var(--qf-down)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)] sm:h-7 sm:w-7"
        aria-label={mine ? "Delete message" : "Remove message"}
        onClick={() => onRemove(m)}
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <li className={`group flex gap-3 px-1 ${continued ? "mt-1" : "mt-5"} ${mine ? "flex-row-reverse" : ""}`}>
      {continued ? (
        <span aria-hidden="true" className="w-8 shrink-0" />
      ) : (
        <span
          aria-hidden="true"
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11.5px] font-semibold ${
            mine ? "bg-[var(--qf-brass)]/15 text-[var(--qf-brass-dark)]" : "bg-[var(--qf-cream-2)] text-[var(--qf-ink)]"
          }`}
        >
          {initials(m.authorName)}
        </span>
      )}
      <div className={`flex min-w-0 max-w-[88%] flex-col sm:max-w-[80%] ${mine ? "items-end" : "items-start"}`}>
        {!continued && (
          <p className={`mb-1 flex flex-wrap items-baseline gap-x-2 text-[13px] ${mine ? "flex-row-reverse" : ""}`}>
            <span className="font-semibold text-[var(--qf-ink)]">{mine ? "You" : m.authorName}</span>
            {m.authorRole && <span className="text-[11px] text-[var(--qf-ink-soft)]">{humanize(m.authorRole)}</span>}
            {time}
          </p>
        )}
        <div className={`flex items-start gap-1 ${mine ? "flex-row-reverse" : ""}`}>
          {m.deleted ? (
            <p className="px-0.5 py-1 text-[13px] italic text-[var(--qf-ink-soft)]">
              {m.removedByModerator ? "This message was removed by an administrator." : "This message was removed."}
            </p>
          ) : editing ? (
            <div className="w-[min(36rem,80vw)] space-y-2">
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
              <div className={`flex gap-2 ${mine ? "justify-end" : ""}`}>
                <button type="button" className={btnSecondary} disabled={busy} onClick={() => { setEditing(false); setDraft(m.body); setError(null); }}>
                  Cancel
                </button>
                <button type="button" className={btnPrimary} disabled={busy || !draft.trim()} onClick={() => void save()}>
                  {busy && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />} Save
                </button>
              </div>
            </div>
          ) : (
            // Plain text: React escapes it, so markup is shown, never run.
            <p
              className={`whitespace-pre-wrap break-words rounded-md border px-3 py-2 text-[14.5px] leading-relaxed text-[var(--qf-ink)] ${
                mine ? "border-[var(--qf-brass)]/25 bg-[var(--qf-brass)]/[0.07]" : "border-[var(--qf-line)] bg-[var(--qf-cream-1)]/60"
              }`}
            >
              {m.body}
            </p>
          )}
          {tools}
        </div>
        {(continued || (m.editedAt && !m.deleted)) && (
          <p className="mt-0.5 flex gap-2 px-0.5 text-[11px] text-[var(--qf-ink-soft)]">
            {continued && time}
            {m.editedAt && !m.deleted && <span>edited</span>}
          </p>
        )}
      </div>
    </li>
  );
}

const STARTERS = ["Share today's Pool update", "Discuss today's trade", "Ask the Pool a question"] as const;

function EmptyConversation({ canPost, onStart }: { canPost: boolean; onStart: (text: string) => void }) {
  return (
    <div className="py-8 sm:py-10">
      <h2 className="font-display text-[22px] font-semibold text-[var(--qf-ink)]">Start the Pool conversation</h2>
      <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">Discuss things relevant to this Pool:</p>
      <ul className="mt-2 grid max-w-xl gap-1 text-[14px] text-[var(--qf-ink)] sm:grid-cols-2">
        {["Today's trades", "Portfolio updates", "Pool operations", "Research ideas", "Questions for other members"].map((t) => (
          <li key={t} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[var(--qf-brass)]" />
            {t}
          </li>
        ))}
      </ul>
      {canPost && (
        <div className="mt-5 flex flex-wrap gap-2">
          {STARTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStart(`${s}: `)}
              className="min-h-10 rounded-md border border-[var(--qf-line)] px-3 text-[13px] text-[var(--qf-ink)] hover:border-[var(--qf-brass)] hover:bg-[var(--qf-cream-1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
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
  const { poolId, userId, poolName } = useFund();
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
  const [participantCount, setParticipantCount] = useState<number | null>(null);

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
      if (typeof page.participantCount === "number") setParticipantCount(page.participantCount);
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

  const composerRef = useRef<HTMLTextAreaElement>(null);
  // Auto-grow the composer up to ~8 lines.
  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);
  const startWith = (text: string) => {
    setDraft(text);
    requestAnimationFrame(() => {
      const el = composerRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    });
  };
  const remaining = MAX_CHARS - draft.length;

  return (
    <>
      <PageHeader
        eyebrow={<Link href={`${poolBase(poolId)}/dashboard`} className="underline-offset-2 hover:underline">← Pool</Link>}
        title="Pool Chat"
        description={`Private conversation for ${poolName}.`}
      />
      <div className="flex w-full max-w-3xl flex-col">
        <p className="-mt-2 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[var(--qf-ink-soft)]">
          <Lock size={12} aria-hidden="true" />
          <span>Only Pool participants can see this conversation.</span>
          {participantCount !== null && participantCount > 0 && (
            <span>· {participantCount} participant{participantCount === 1 ? "" : "s"}</span>
          )}
        </p>
        <div className="flex h-[min(72vh,calc(100dvh-15rem))] min-h-[24rem] flex-col border-t border-[var(--qf-line)]">
          <div
            ref={scroller}
            className="flex-1 overflow-y-auto overscroll-contain pb-4"
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
                <p role="alert" className="py-5 text-[14px] text-[var(--qf-down)]">Could not load the chat: {loadError}</p>
              ) : (
                <LoadingSkeleton label="Loading messages" />
              )
            ) : messages.length === 0 ? (
              <EmptyConversation canPost={canPost} onStart={startWith} />
            ) : (
              <>
                {hasOlder && (
                  <div className="flex justify-center pt-4">
                    <button
                      type="button"
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-[13px] text-[var(--qf-ink-soft)] hover:bg-[var(--qf-cream-1)] hover:text-[var(--qf-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]"
                      onClick={() => void loadOlder()}
                      disabled={loadingOlder}
                    >
                      {loadingOlder && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                      Load earlier messages
                    </button>
                  </div>
                )}
                <ul className="pt-1" aria-label="Messages">
                  {rows.map((r, i) => {
                    if ("day" in r) {
                      return (
                        <li key={`d${r.day}`} className="mt-6 flex items-center gap-3" aria-hidden="true">
                          <span className="h-px flex-1 bg-[var(--qf-line)]" />
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--qf-ink-soft)]">{dayLabel(r.day)}</span>
                          <span className="h-px flex-1 bg-[var(--qf-line)]" />
                        </li>
                      );
                    }
                    const prev = rows[i - 1];
                    const continued =
                      prev !== undefined &&
                      "msg" in prev &&
                      prev.msg.userId === r.msg.userId &&
                      !prev.msg.deleted &&
                      new Date(r.msg.createdAt).getTime() - new Date(prev.msg.createdAt).getTime() < GROUP_MS;
                    return (
                      <MessageRow
                        key={r.msg.id}
                        m={r.msg}
                        mine={r.msg.userId === userId}
                        continued={continued}
                        canModerate={canModerate}
                        onChanged={upsert}
                        onRemove={setRemoving}
                      />
                    );
                  })}
                </ul>
              </>
            )}
          </div>

          <div className="sticky bottom-0 border-t border-[var(--qf-line)] bg-[var(--qf-cream-0)] pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {canPost ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="flex items-end gap-2 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)]/40 p-1.5 focus-within:border-[var(--qf-brass)]"
              >
                <label htmlFor="pool-chat-composer" className="sr-only">Message</label>
                <textarea
                  id="pool-chat-composer"
                  ref={composerRef}
                  className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-relaxed text-[var(--qf-ink)] placeholder:text-[var(--qf-ink-soft)] focus:outline-none"
                  rows={1}
                  placeholder="Share an update, question, or thought about this Pool…"
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
                <button type="submit" className={`${btnPrimary} min-h-10 shrink-0`} disabled={sendState === "sending" || !draft.trim()}>
                  {sendState === "sending" ? (
                    <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <Send size={15} aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">Send</span>
                  <span className="sr-only sm:hidden">Send</span>
                </button>
              </form>
            ) : (
              <p className="text-[13px] text-[var(--qf-ink-soft)]">You can read this conversation but cannot post in it.</p>
            )}
            <p id="pool-chat-status" className="mt-1.5 flex flex-wrap justify-between gap-2 px-0.5 text-[11.5px] text-[var(--qf-ink-soft)]">
              <span role={sendState === "failed" ? "alert" : undefined} className={sendState === "failed" ? "text-[var(--qf-down)]" : undefined}>
                {sendState === "sending"
                  ? "Sending…"
                  : sendState === "sent"
                    ? "Sent."
                    : sendState === "failed"
                      ? `Not sent: ${sendError ?? "please try again."}`
                      : canPost
                        ? "Enter to send · Shift + Enter for a new line"
                        : ""}
              </span>
              <span>
                {remaining <= 200 && <span className={remaining <= 50 ? "text-[var(--qf-down)]" : undefined}>{remaining} characters left · </span>}
                {loadError && loaded ? "Could not refresh. Retrying…" : lastSync ? `Updates every ${POLL_MS / 1000} seconds` : ""}
              </span>
            </p>
          </div>
        </div>
      </div>
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
