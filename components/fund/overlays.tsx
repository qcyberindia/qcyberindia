"use client";

// Overlays built on the native <dialog> element: the browser provides the
// focus trap, Escape handling, inert background and top-layer stacking, so
// there is no hand-rolled ARIA to get wrong. Content is mounted only while
// open, so every form starts fresh each time.
import { useEffect, useId, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { btnDanger, btnPrimary, btnSecondary } from "@/components/fund/parts";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** "center" (default) or a side sheet. */
  placement?: "center" | "left" | "right";
};

const SHELL =
  "border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-0 text-[var(--qf-ink)] shadow-lg backdrop:bg-black/40";

const PLACEMENT: Record<NonNullable<ModalProps["placement"]>, string> = {
  center: "m-auto w-[calc(100%-1.5rem)] max-w-lg rounded-lg",
  left: "m-0 mr-auto h-dvh max-h-none w-[86%] max-w-sm rounded-none",
  right: "m-0 ml-auto h-dvh max-h-none w-full max-w-md rounded-none",
};

export function Modal({ open, onClose, title, description, children, placement = "center" }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the <dialog> itself (not its content) is a backdrop click.
        if (e.target === ref.current) onClose();
      }}
      className={`${SHELL} ${PLACEMENT[placement]}`}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-[var(--qf-line)] px-5 py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="font-display text-lg font-semibold">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-[13px] text-[var(--qf-ink-soft)]">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 rounded p-1.5 text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]"
            >
              <X size={16} />
            </button>
          </div>
          <div className="overflow-y-auto">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** A side sheet: used for the mobile navigation and detail panels. */
export function Drawer(props: Omit<ModalProps, "placement"> & { side?: "left" | "right" }) {
  const { side = "right", ...rest } = props;
  return <Modal {...rest} placement={side} />;
}

export function FormDialog({
  open,
  onClose,
  title,
  description,
  submitLabel,
  pending = false,
  error,
  onSubmit,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  submitLabel: string;
  pending?: boolean;
  /** A server error to show inline, above the buttons. */
  error?: string | null;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} description={description}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) onSubmit();
        }}
      >
        <div className="space-y-4 px-5 py-4">{children}</div>
        {error && (
          <p
            role="alert"
            className="mx-5 mb-3 rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]"
          >
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--qf-line)] px-5 py-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={pending} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {pending ? "Working\u2026" : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmBody({
  description,
  consequences,
  confirmLabel,
  destructive,
  pending,
  error,
  reasonLabel,
  onConfirm,
  onCancel,
}: {
  description?: React.ReactNode;
  consequences?: string;
  confirmLabel: string;
  destructive: boolean;
  pending: boolean;
  error?: string | null;
  reasonLabel?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const reasonId = useId();
  const needsReason = Boolean(reasonLabel);
  const blocked = pending || (needsReason && reason.trim().length < 3);

  return (
    <div>
      <div className="space-y-3 px-5 py-4 text-[14px]">
        {description && <div className="text-[var(--qf-ink)]">{description}</div>}
        {consequences && (
          <p className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-3 py-2 text-[13px] text-[var(--qf-ink-soft)]">
            {consequences}
          </p>
        )}
        {needsReason && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={reasonId} className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
              {reasonLabel}
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              required
              className="w-full rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3 py-2 text-[14px] outline-none focus:border-[var(--qf-brass)] focus:ring-2 focus:ring-[var(--qf-brass)]/15"
            />
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-[var(--qf-line)] px-5 py-3 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={pending} className={btnSecondary}>
          Cancel
        </button>
        <button
          type="button"
          disabled={blocked}
          onClick={() => onConfirm(reason.trim())}
          className={destructive ? btnDanger : btnPrimary}
        >
          {pending && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {pending ? "Working\u2026" : confirmLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Confirmation for consequential or destructive actions. Always explain the
 * consequence; pass `reasonLabel` to require a written reason (audited).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  consequences,
  confirmLabel,
  destructive = false,
  pending = false,
  error,
  reasonLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  consequences?: string;
  confirmLabel: string;
  destructive?: boolean;
  pending?: boolean;
  error?: string | null;
  reasonLabel?: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <ConfirmBody
        description={description}
        consequences={consequences}
        confirmLabel={confirmLabel}
        destructive={destructive}
        pending={pending}
        error={error}
        reasonLabel={reasonLabel}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </Modal>
  );
}
