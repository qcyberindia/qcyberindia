"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { btnSecondary } from "@/components/fund/parts";
import { inputClass } from "@/components/fund/forms";

export type Column<T> = {
  key: string;
  header: string;
  /** Renders the cell. Receives the row. */
  cell: (row: T) => React.ReactNode;
  align?: "left" | "right";
  /** The primary column becomes the title of the mobile card. */
  primary?: boolean;
  /** Leave out of the mobile card (secondary detail). */
  hideOnMobile?: boolean;
};

type TableProps<T> = {
  columns: ReadonlyArray<Column<T>>;
  rows: ReadonlyArray<T>;
  rowKey: (row: T) => string | number;
  /** When set, the primary column links to the record. */
  rowHref?: (row: T) => string;
  caption: string;
  /** Optional per-row action (e.g. "Details" opening a drawer). */
  rowAction?: (row: T) => React.ReactNode;
};

export function MobileDataCard<T>({
  row,
  columns,
  href,
  action,
}: {
  row: T;
  columns: ReadonlyArray<Column<T>>;
  href?: string;
  action?: React.ReactNode;
}) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const rest = columns.filter((c) => c !== primary && !c.hideOnMobile);
  const title = primary.cell(row);
  return (
    <li className="rounded-lg border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 font-display text-[15px] font-semibold text-[var(--qf-ink)]">
          {href ? (
            <Link href={href} className="underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]">
              {title}
            </Link>
          ) : (
            title
          )}
        </div>
        {action}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
        {rest.map((c) => (
          <div key={c.key} className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">{c.header}</dt>
            <dd className="mt-0.5 break-words text-[var(--qf-ink)]">{c.cell(row)}</dd>
          </div>
        ))}
      </dl>
    </li>
  );
}

/**
 * Desktop: a real <table>. Phones: the same rows as cards, so nothing needs
 * horizontal scrolling. Both are in the DOM; CSS shows one.
 */
export function DataTable<T>({ columns, rows, rowKey, rowHref, caption, rowAction }: TableProps<T>) {
  const primaryKey = (columns.find((c) => c.primary) ?? columns[0]).key;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-[13.5px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-[var(--qf-line)] bg-[var(--qf-cream-1)]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)] ${
                    c.align === "right" ? "text-right" : ""
                  }`}
                >
                  {c.header}
                </th>
              ))}
              {rowAction && (
                <th scope="col" className="px-4 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <tr key={rowKey(row)} className="border-b border-[var(--qf-line)] last:border-b-0 hover:bg-[var(--qf-cream-1)]/60">
                  {columns.map((c) => {
                    const content = c.cell(row);
                    return (
                      <td key={c.key} className={`px-4 py-3 align-top text-[var(--qf-ink)] ${c.align === "right" ? "text-right" : ""}`}>
                        {href && c.key === primaryKey ? (
                          <Link href={href} className="font-semibold underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]">
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </td>
                    );
                  })}
                  {rowAction && <td className="px-4 py-3 text-right align-top">{rowAction(row)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 p-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <MobileDataCard key={rowKey(row)} row={row} columns={columns} href={rowHref?.(row)} action={rowAction?.(row)} />
        ))}
      </ul>
    </>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  count,
  onPage,
}: {
  page: number;
  pageSize: number;
  /** Total matching records if the API reports it, otherwise null. */
  total: number | null;
  /** Number of records on the current page. */
  count: number;
  onPage: (page: number) => void;
}) {
  const first = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = (page - 1) * pageSize + count;
  const hasNext = total !== null ? page * pageSize < total : count >= pageSize;
  if (page === 1 && !hasNext) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 border-t border-[var(--qf-line)] px-4 py-3 text-[13px] text-[var(--qf-ink-soft)]">
      <p aria-live="polite">
        {count === 0 ? "No records on this page" : `Showing ${first}\u2013${last}${total !== null ? ` of ${total}` : ""}`}
      </p>
      <div className="flex gap-2">
        <button type="button" className={btnSecondary} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={14} aria-hidden="true" /> Previous
        </button>
        <button type="button" className={btnSecondary} disabled={!hasNext} onClick={() => onPage(page + 1)}>
          Next <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

/** Wrapper for list filters. Children are form controls; `onReset` clears them. */
export function FilterBar({
  children,
  onReset,
  dirty = false,
}: {
  children: React.ReactNode;
  onReset?: () => void;
  dirty?: boolean;
}) {
  return (
    <div role="search" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-3 sm:p-4">
      {children}
      {onReset && dirty && (
        <button type="button" onClick={onReset} className={btnSecondary}>
          Clear filters
        </button>
      )}
    </div>
  );
}

/** A labelled filter control (select, date) sized for FilterBar. */
export function FilterField({ label, children }: { label: string; children: (id: string) => React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex min-w-[9rem] flex-1 flex-col gap-1 sm:flex-none">
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
        {label}
      </label>
      {children(id)}
    </div>
  );
}

/**
 * Search applied on submit (Enter or the button), not on every keystroke,
 * so typing does not fire a request per character.
 */
export function SearchInput({
  label,
  placeholder,
  applied,
  onSearch,
}: {
  label: string;
  placeholder?: string;
  applied: string;
  onSearch: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(applied);
  return (
    <form
      className="flex min-w-[12rem] flex-[2] flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(draft.trim());
      }}
    >
      <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="search"
          value={draft}
          maxLength={80}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass}
        />
        <button type="submit" className={btnSecondary} aria-label={`Search: ${label}`}>
          <Search size={15} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
