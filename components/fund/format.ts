// Display formatting for QFinera Fund. Input is always a DECIMAL STRING (or
// Money); values are never routed through JavaScript floating point, and
// nothing formatted here is ever fed back into accounting.
import { Money } from "../../lib/accounting/money";

/** Indian digit grouping: 1234567 -> 12,34,567. */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

export type FormatOptions = { scale: 2 | 4; signed?: boolean };

/** "-1234567.5" -> "-12,34,567.50". Returns "N/A" for null/undefined/invalid. */
export function formatDecimal(value: string | Money | null | undefined, opts: FormatOptions): string {
  if (value === null || value === undefined || value === "") return "N/A";
  let text: string;
  try {
    const money = typeof value === "string" ? Money.fromDecimalString(value) : value;
    text = money.toDecimalString(opts.scale);
  } catch {
    return "N/A";
  }
  const negative = text.startsWith("-");
  const [intPart, frac] = (negative ? text.slice(1) : text).split(".");
  const grouped = `${groupIndian(intPart)}.${frac}`;
  if (negative) return `-${grouped}`;
  const isZero = /^0\.0+$/.test(text);
  return opts.signed && !isZero ? `+${grouped}` : grouped;
}

export const formatMoney = (v: string | Money | null | undefined, signed = false) => {
  const text = formatDecimal(v, { scale: 2, signed });
  if (text === "N/A") return text;
  return text.startsWith("-") ? `-\u20B9${text.slice(1)}` : text.startsWith("+") ? `+\u20B9${text.slice(1)}` : `\u20B9${text}`;
};

export const formatNav = (v: string | Money | null | undefined) => {
  const text = formatDecimal(v, { scale: 4 });
  return text === "N/A" ? text : `\u20B9${text}`;
};

export const formatUnits = (v: string | Money | null | undefined) => formatDecimal(v, { scale: 4 });

/** Percent given as a 2dp decimal string already in percent units ("25.00" -> "25.00%"). */
export function formatPercent(v: string | Money | null | undefined, signed = false): string {
  const text = formatDecimal(v, { scale: 2, signed });
  return text === "N/A" ? text : `${text}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-01" -> "01 Oct 2026" (no timezone shift: it is a calendar date). */
export function formatCalendarDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return "-";
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${match[3]} ${month} ${match[1]}` : "-";
}

/** A timestamp rendered in IST, e.g. "01 Oct 2026, 14:05 IST". */
export function formatTimestampIst(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "-";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} IST`;
}

/** XIRR rate (a fraction such as 0.1234) -> "12.34%" or "N/A". Display only. */
export function formatXirr(rate: number | null | undefined): string {
  return rate === null || rate === undefined || !Number.isFinite(rate) ? "N/A" : `${(rate * 100).toFixed(2)}%`;
}

export const formatIsoDate = formatCalendarDate;

export const formatQuantity = (
  v: string | Money | null | undefined,
): string => formatDecimal(v, { scale: 4 });

export const formatTimestamp = formatTimestampIst;

export function humanize(value: string | null | undefined): string {
  if (!value) return "-";

  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function toneOf(
  value: string | number | null | undefined,
): "positive" | "negative" | "neutral" {
  if (value === null || value === undefined) return "neutral";

  if (typeof value === "number") {
    if (value > 0) return "positive";
    if (value < 0) return "negative";
    return "neutral";
  }

  const normalized = value.trim();

  if (normalized.startsWith("+")) return "positive";
  if (normalized.startsWith("-")) return "negative";

  return "neutral";
}
