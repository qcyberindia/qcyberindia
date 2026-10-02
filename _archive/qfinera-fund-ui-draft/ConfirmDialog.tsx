"use client";

// Accessible confirmation dialog built on the native <dialog> element, which
// provides the focus trap, Escape handling and inert background. Mount it
// only while open (the parent renders it conditionally), so its reason text
// resets naturally each time.
import { useEffect, useId, useRef, useState } from "react";
import { buttonClass, secondaryButtonClass } from "@/components/fund/ui";

export type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  /** "required" blocks confirming until a reason of 3+ characters is entered. */
  reason?: "none" | "optional" | "required";
  busy?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  reason = "none",
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const reasonId = useId();
  const [text, setText] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const blocked = busy || (reason === "required" && text.trim().length < 3);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-5 text-[var(--qf-ink)] backdrop:bg-black/40"
    >
      <h2 id={titleId} className="font-display text-lg font-semibold">
        {title}
      </h2>
      <p id={descId} className="mt-2 text-sm text-[var(--qf-ink-soft)]">
        {description}
      </p>

      {reason !== "none" ? (
        <div className="mt-4">
          <label htmlFor={reasonId} className="block text-sm font-medium">
            Reason{reason === "optional" ? " (optional)" : ""}
          </label>
          <textarea
            id={reasonId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--qf-down)]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={secondaryButtonClass} onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className={buttonClass} onClick={() => onConfirm(text.trim())} disabled={blocked}>
          {busy ? "Working..." : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
