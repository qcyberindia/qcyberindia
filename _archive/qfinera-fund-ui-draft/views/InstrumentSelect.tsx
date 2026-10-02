"use client";

import { useState } from "react";
import { endpoints, listOf, type InstrumentDto } from "@/components/fund/api";
import { FormField, inputClass } from "@/components/fund/forms";
import { useFundResource } from "@/components/fund/useResource";

const MAX_OPTIONS = 100;

/**
 * Searchable instrument picker. Mount it only when needed (e.g. inside an
 * open dialog) because it fetches the instrument list on mount. A text box
 * narrows the list; the native <select> keeps keyboard and screen-reader
 * behaviour for free.
 */
export function InstrumentSelect({
  value,
  onChange,
  error,
  required = false,
  label = "Instrument",
}: {
  value: string;
  onChange: (instrumentId: string) => void;
  error?: string | null;
  required?: boolean;
  label?: string;
}) {
  const [filter, setFilter] = useState("");
  const res = useFundResource(endpoints.instruments, {}, (json) => listOf<InstrumentDto>(json));
  const all = res.data?.items ?? [];
  const needle = filter.trim().toLowerCase();
  const matches = needle
    ? all.filter((i) => i.symbol.toLowerCase().includes(needle) || (i.name ?? "").toLowerCase().includes(needle))
    : all;
  const shown = matches.slice(0, MAX_OPTIONS);
  // Keep the chosen instrument selectable even when the filter hides it.
  const selected = all.find((i) => String(i.id) === value);
  const options = selected && !shown.includes(selected) ? [selected, ...shown] : shown;

  return (
    <div className="space-y-2">
      <FormField label={`Find ${label.toLowerCase()}`} hint="Type a symbol or company name to narrow the list.">
        {(p) => (
          <input
            {...p}
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            disabled={res.loading || Boolean(res.error)}
            className={inputClass}
          />
        )}
      </FormField>
      <FormField label={label} required={required} error={error ?? (res.error ? res.error.message : null)}>
        {(p) => (
          <select
            {...p}
            value={value}
            required={required}
            disabled={res.loading || Boolean(res.error)}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          >
            <option value="">
              {res.loading ? "Loading instruments\u2026" : options.length === 0 ? "No instruments found" : "Choose an instrument"}
            </option>
            {options.map((i) => (
              <option key={i.id} value={String(i.id)}>
                {i.symbol} ({i.exchange}){i.name ? ` \u2013 ${i.name}` : ""}
              </option>
            ))}
          </select>
        )}
      </FormField>
      {matches.length > MAX_OPTIONS && (
        <p className="text-[12px] text-[var(--qf-ink-soft)]">Showing the first {MAX_OPTIONS} matches. Keep typing to narrow the list.</p>
      )}
    </div>
  );
}
