// Presentational building blocks for the QFinera Fund workspace.
// Server-safe (no hooks, no browser APIs). Colours come from the existing
// --qf-* tokens so light/dark mode works automatically. Meaning is never
// carried by colour alone: status badges carry a text label and P&L carries
// a +/- sign.
import Link from "next/link";
import type { ReactNode } from "react";
import {
  formatCalendarDate,
  formatMoney,
  formatNav,
  formatPercent,
  formatTimestampIst,
  formatUnits,
} from "@/components/fund/format";

// ---------------------------------------------------------------- status

type Tone = "neutral" | "brass" | "good" | "bad";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-[var(--qf-line)] bg-[var(--qf-cream-1)] text-[var(--qf-ink-soft)]",
  brass: "border-[var(--qf-brass)] bg-[var(--qf-cream-1)] text-[var(--qf-brass-dark)]",
  good: "border-[var(--qf-fix)] bg-[var(--qf-fix-bg)] text-[var(--qf-fix)]",
  bad: "border-[var(--qf-down)] bg-[var(--qf-cream-1)] text-[var(--qf-down)]",
};

const STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending approval", tone: "brass" },
  REQUESTED: { label: "Requested", tone: "brass" },
  DRAFT: { label: "Draft", tone: "neutral" },
  APPROVED: { label: "Approved", tone: "good" },
  AWAITING_NAV: { label: "Awaiting NAV", tone: "brass" },
  EXECUTED: { label: "Executed", tone: "good" },
  SETTLED: { label: "Settled", tone: "good" },
  FINALIZED: { label: "Finalized", tone: "good" },
  REJECTED: { label: "Rejected", tone: "bad" },
  REVERSED: { label: "Reversed", tone: "bad" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  active: { label: "Active", tone: "good" },
  suspended: { label: "Suspended", tone: "bad" },
  ADMIN: { label: "Admin", tone: "brass" },
  MANAGER: { label: "Manager", tone: "neutral" },
  MEMBER: { label: "Member", tone: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[entry.tone]}`}
    >
      {entry.label}
    </span>
  );
}

// -------------------------------------------------------------- display

const num = "tabular-nums whitespace-nowrap";

function signClass(raw: string | null | undefined): string {
  if (!raw) return "";
  const text = raw.trim();
  if (/^[-+]?0*(\.0*)?$/.test(text)) return "";
  return text.startsWith("-") ? "text-[var(--qf-down)]" : "text-[var(--qf-up)]";
}

/** Rupee amount. `signed` shows +/- (for P&L) and tints by sign. */
export function MoneyDisplay({ value, signed = false }: { value: string | null | undefined; signed?: boolean }) {
  return <span className={`${num} ${signed ? signClass(value) : ""}`}>{formatMoney(value, signed)}</span>;
}

export function NavDisplay({ value }: { value: string | null | undefined }) {
  return <span className={num}>{formatNav(value)}</span>;
}

export function QuantityDisplay({ value }: { value: string | null | undefined }) {
  return <span className={num}>{formatUnits(value)}</span>;
}

export function PercentDisplay({ value, signed = false }: { value: string | null | undefined; signed?: boolean }) {
  return <span className={`${num} ${signed ? signClass(value) : ""}`}>{formatPercent(value, signed)}</span>;
}

/** `value` is a calendar date (YYYY-MM-DD) or a timestamp (Date). */
export function DateDisplay({ value, time = false }: { value: string | Date | null | undefined; time?: boolean }) {
  if (value instanceof Date || time) return <span className={num}>{formatTimestampIst(value)}</span>;
  return <span className={num}>{formatCalendarDate(value)}</span>;
}

// ----------------------------------------------------------- structure

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-[var(--qf-ink-soft)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function SectionCard({
  title,
  action,
  children,
  id,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className="rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-4 sm:p-5"
    >
      {title ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={headingId} className="font-display text-lg font-semibold">
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--qf-ink-soft)]">{label}</p>
      <p className="mt-1.5 font-display text-xl font-semibold sm:text-2xl">{children}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--qf-ink-soft)]">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--qf-line)] px-4 py-8 text-center">
      <p className="font-display text-base font-semibold">{title}</p>
      {children ? <div className="mx-auto mt-1 max-w-md text-sm text-[var(--qf-ink-soft)]">{children}</div> : null}
    </div>
  );
}

export function ErrorState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-[var(--qf-down)] bg-[var(--qf-cream-1)] p-4">
      <p className="font-semibold text-[var(--qf-down)]">{title}</p>
      {children ? <div className="mt-1 text-sm text-[var(--qf-ink-soft)]">{children}</div> : null}
    </div>
  );
}

/** A labelled value, for detail pages. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[var(--qf-ink-soft)]">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

// ----------------------------------------------------------------- table

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
  /** Rendered as the card title on small screens. */
  primary?: boolean;
};

/**
 * A real <table> from md upward and a stack of cards below it, so there is
 * never horizontal page overflow on a phone.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
}) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[var(--qf-line)] text-left text-xs uppercase tracking-wide text-[var(--qf-ink-soft)]">
              {columns.map((c) => (
                <th key={c.header} scope="col" className={`px-3 py-2 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-[var(--qf-line)] last:border-0">
                {columns.map((c) => (
                  <td key={c.header} className={`px-3 py-2.5 align-top ${c.align === "right" ? "text-right" : ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-lg border border-[var(--qf-line)] p-3">
            <div className="mb-2 font-medium">{primary.cell(row)}</div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              {columns
                .filter((c) => c !== primary)
                .map((c) => (
                  <Field key={c.header} label={c.header}>
                    {c.cell(row)}
                  </Field>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

// ------------------------------------------------------------ pagination

export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkClass =
    "rounded-lg border border-[var(--qf-line)] px-3 py-1.5 text-sm hover:bg-[var(--qf-cream-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)]";
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-[var(--qf-ink-soft)]">
        {from}-{to} of {total}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className={linkClass} href={hrefFor(page - 1)} rel="prev">
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link className={linkClass} href={hrefFor(page + 1)} rel="next">
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

// -------------------------------------------------------------- timeline

export type TimelineItem = {
  key: string | number;
  title: string;
  meta: ReactNode;
  detail?: ReactNode;
};

export function ActivityTimeline({ items, label }: { items: TimelineItem[]; label: string }) {
  if (items.length === 0) return <EmptyState title="No activity yet" />;
  return (
    <ol aria-label={label} className="space-y-4 border-l border-[var(--qf-line)] pl-4">
      {items.map((item) => (
        <li key={item.key} className="relative">
          <span aria-hidden="true" className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--qf-brass)]" />
          <p className="text-sm font-medium">{item.title}</p>
          <p className="text-xs text-[var(--qf-ink-soft)]">{item.meta}</p>
          {item.detail ? <div className="mt-1 text-sm text-[var(--qf-ink-soft)]">{item.detail}</div> : null}
        </li>
      ))}
    </ol>
  );
}

export const buttonClass =
  "inline-flex items-center justify-center rounded-lg border border-[var(--qf-brass)] bg-[var(--qf-brass)] px-4 py-2 text-sm font-medium text-[var(--qf-cream-0)] hover:bg-[var(--qf-brass-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)] disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-lg border border-[var(--qf-line)] px-4 py-2 text-sm font-medium hover:bg-[var(--qf-cream-2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)] disabled:cursor-not-allowed disabled:opacity-60";
