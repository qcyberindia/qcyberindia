"use client";

import { useId } from "react";
import { AlertCircle } from "lucide-react";

export const inputClass =
  "w-full min-h-10 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3 py-2 text-[14.5px] text-[var(--qf-ink)] outline-none transition-colors placeholder:text-[var(--qf-ink-soft)]/60 focus:border-[var(--qf-brass)] focus:ring-2 focus:ring-[var(--qf-brass)]/15 disabled:opacity-60 aria-[invalid=true]:border-[var(--qf-down)]";

export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
};

/**
 * Label + control + hint + error, wired together for assistive technology.
 * `children` receives the id/aria props to spread onto the control.
 */
export function FormField({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: (props: FieldControlProps) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
        <span>
          {label}
          {required && (
            <span className="text-[var(--qf-brass-dark)]">
              <span aria-hidden="true"> *</span>
              <span className="sr-only"> (required)</span>
            </span>
          )}
        </span>
        {required === false && <span className="text-[10.5px] font-medium normal-case tracking-normal opacity-80">Optional</span>}
      </label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="text-[12px] text-[var(--qf-ink-soft)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1 text-[12px] font-medium text-[var(--qf-down)]">
          <AlertCircle size={13} className="mt-px shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

type CommonProps = {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
};

/**
 * Money, units, NAV and prices are typed as TEXT and sent to the server as
 * decimal strings, never parsed to numbers in the browser. `inputMode`
 * brings up the numeric keypad on phones.
 */
export function DecimalField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  decimals,
  placeholder,
  disabled,
}: CommonProps & {
  value: string;
  onChange: (value: string) => void;
  /** Maximum decimal places the server accepts for this field. */
  decimals: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <FormField label={label} hint={hint ?? `Up to ${decimals} decimal places`} error={error} required={required}>
      {(p) => (
        <input
          {...p}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          // Allow only digits and one decimal point as the user types.
          onChange={(e) => {
            const next = e.target.value.replace(/[^\d.]/g, "");
            if ((next.match(/\./g) ?? []).length <= 1) onChange(next);
          }}
          className={inputClass}
        />
      )}
    </FormField>
  );
}

export function TextField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  type = "text",
  maxLength,
  placeholder,
  disabled,
}: CommonProps & {
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "date" | "url";
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      {(p) => (
        <input
          {...p}
          type={type}
          value={value}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </FormField>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  rows = 3,
  maxLength,
  disabled,
}: CommonProps & {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      {(p) => (
        <textarea
          {...p}
          value={value}
          rows={rows}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </FormField>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  options,
  disabled,
}: CommonProps & {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      {(p) => (
        <select
          {...p}
          value={value}
          required={required}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}

/**
 * A small set of mutually exclusive choices shown as buttons (a radio
 * group): used where every option should be visible at once, e.g. the
 * trade ticket's segment, product and position action.
 */
export function SegmentedField<V extends string>({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  options,
}: CommonProps & {
  value: V | null;
  onChange: (value: V) => void;
  options: ReadonlyArray<{ value: V; label: string; disabled?: boolean; title?: string }>;
}) {
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      {(p) => (
        <div id={p.id} role="radiogroup" aria-describedby={p["aria-describedby"]} aria-invalid={p["aria-invalid"]} className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={o.disabled}
                title={o.title}
                onClick={() => onChange(o.value)}
                className={`min-h-9 rounded-md border px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  selected
                    ? "border-[var(--qf-brass)] bg-[var(--qf-brass)]/12 text-[var(--qf-ink)]"
                    : "border-[var(--qf-line)] text-[var(--qf-ink-soft)] hover:border-[var(--qf-brass)]/60"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </FormField>
  );
}
