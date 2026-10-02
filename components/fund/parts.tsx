import { AlertTriangle, Inbox } from "lucide-react";
import { ApiError } from "@/components/fund/api";
import { MoneyDisplay, PercentDisplay, QuantityDisplay } from "@/components/fund/display";

export const btnPrimary =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md bg-[var(--qf-brass-dark)] px-4 py-2 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)] disabled:cursor-not-allowed disabled:opacity-60";

export const btnSecondary =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-4 py-2 text-sm font-semibold text-[var(--qf-ink)] transition-colors hover:border-[var(--qf-brass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)] disabled:cursor-not-allowed disabled:opacity-60";

export const btnDanger =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md border border-[var(--qf-down)]/50 bg-[var(--qf-down)]/10 px-4 py-2 text-sm font-semibold text-[var(--qf-down)] transition-colors hover:bg-[var(--qf-down)]/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-down)] disabled:cursor-not-allowed disabled:opacity-60";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-brass-dark)]">{eyebrow}</p>
        )}
        <h1 className="font-display text-2xl font-semibold leading-tight text-[var(--qf-ink)] sm:text-[28px]">
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] text-[var(--qf-ink-soft)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  flush = false,
  id,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Remove body padding (tables that run edge to edge). */
  flush?: boolean;
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className="rounded-lg border border-[var(--qf-line)] bg-[var(--qf-cream-0)]"
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--qf-line)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 id={headingId} className="font-display text-[17px] font-semibold text-[var(--qf-ink)]">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-[13px] text-[var(--qf-ink-soft)]">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-4 sm:p-5"}>{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4">
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">{label}</p>
      <div className="mt-1.5 font-display text-[22px] font-semibold leading-tight text-[var(--qf-ink)] sm:text-2xl">
        {children}
      </div>
      {hint && <p className="mt-1 text-[12px] text-[var(--qf-ink-soft)]">{hint}</p>}
    </div>
  );
}

/** A MetricCard for one server-supplied value. */
export function FinancialMetric({
  label,
  value,
  kind = "money",
  signed = false,
  hint,
}: {
  label: string;
  value: string | number | null | undefined;
  kind?: "money" | "percent" | "quantity" | "count" | "nav";
  signed?: boolean;
  hint?: string;
}) {
  const text = typeof value === "number" ? String(value) : value;
  return (
    <MetricCard label={label} hint={hint}>
      {kind === "money" && <MoneyDisplay value={text} signed={signed} />}
      {kind === "nav" && <MoneyDisplay value={text} dp={4} />}
      {kind === "percent" && <PercentDisplay value={text} signed={signed} />}
      {kind === "quantity" && <QuantityDisplay value={text} />}
      {kind === "count" && (text === null || text === undefined ? <MoneyDisplay value={null} /> : <span>{text}</span>)}
    </MetricCard>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--qf-cream-1)] text-[var(--qf-ink-soft)]">
        <Inbox size={18} aria-hidden="true" />
      </span>
      <p className="mt-3 font-display text-[16px] font-semibold text-[var(--qf-ink)]">{title}</p>
      {description && <p className="mt-1 max-w-md text-[13.5px] text-[var(--qf-ink-soft)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingSkeleton({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3 p-4 sm:p-5">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-5 animate-pulse rounded bg-[var(--qf-cream-2)] motion-reduce:animate-none"
          style={{ width: `${100 - (i % 3) * 12}%` }}
        />
      ))}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: Error | string;
  onRetry?: () => void;
}) {
  const message = typeof error === "string" ? error : error.message;
  const forbidden = error instanceof ApiError && error.status === 403;
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--qf-down)]/10 text-[var(--qf-down)]">
        <AlertTriangle size={18} aria-hidden="true" />
      </span>
      <p className="mt-3 font-display text-[16px] font-semibold text-[var(--qf-ink)]">
        {forbidden ? "You do not have access to this" : "We couldn\u2019t load this"}
      </p>
      <p className="mt-1 max-w-md text-[13.5px] text-[var(--qf-ink-soft)]">{message}</p>
      {onRetry && !forbidden && (
        <button type="button" onClick={onRetry} className={`${btnSecondary} mt-4`}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-3.5 py-2.5 text-[12.5px] text-[var(--qf-ink-soft)]">
      {children}
    </p>
  );
}
