"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

type Tone = "success" | "error";
type Notice = { id: number; tone: Tone; message: string };
type NoticeApi = { notify: (tone: Tone, message: string) => void };

const NoticeContext = createContext<NoticeApi | null>(null);

/** Success/error feedback shown in an ARIA live region (announced, not just visual). */
export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setNotices((list) => list.filter((n) => n.id !== id)), []);

  const notify = useCallback(
    (tone: Tone, message: string) => {
      const id = ++nextId.current;
      setNotices((list) => [...list.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 9000 : 5000);
    },
    [dismiss]
  );

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <NoticeContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-20 z-[60] flex flex-col items-stretch gap-2 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-96"
      >
        {notices.map((n) => (
          <div
            key={n.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 text-[13.5px] shadow-sm ${
              n.tone === "success"
                ? "border-[var(--qf-up)]/40 bg-[var(--qf-cream-0)] text-[var(--qf-ink)]"
                : "border-[var(--qf-down)]/40 bg-[var(--qf-cream-0)] text-[var(--qf-ink)]"
            }`}
          >
            <span
              className={`mt-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                n.tone === "success" ? "text-[var(--qf-up)]" : "text-[var(--qf-down)]"
              }`}
            >
              {n.tone === "success" ? "Done" : "Error"}
            </span>
            <span className="flex-1">{n.message}</span>
            <button
              type="button"
              onClick={() => dismiss(n.id)}
              aria-label="Dismiss message"
              className="rounded p-0.5 text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </NoticeContext.Provider>
  );
}

export function useNotice(): NoticeApi {
  const api = useContext(NoticeContext);
  if (!api) throw new Error("useNotice must be used inside <NoticeProvider>");
  return api;
}
