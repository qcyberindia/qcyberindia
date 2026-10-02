import { formatCalendarDate, formatDecimal, formatTimestampIst, humanize } from "@/components/fund/format";

// Presentational value components. They format server-supplied decimal
// STRINGS as text; no arithmetic, no rounding beyond display scale. A missing
// value renders an explicit dash (with screen-reader text), never an
// invented zero. Gain/loss is shown with a sign AND colour, never colour alone.

const NUM = "tabular-nums whitespace-nowrap";

function Missing({ label = "Not available" }: { label?: string }) {
  return (
    <span className="text-[var(--qf-ink-soft)]">
      <span aria-hidden="true">&mdash;</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function toneClass(text: string, signed: boolean): string {
  if (!signed) return "";
  if (text.startsWith("-")) return "text-[var(--qf-down)]";
  if (text.startsWith("+")) return "text-[var(--qf-up)]";
  return "";
}

/** Rupees. dp=4 for NAV and prices; `signed` adds +/- and tints gain/loss. */
export function MoneyDisplay({
  value,
  dp = 2,
  signed = false,
  className = "",
}: {
  value: string | null | undefined;
  dp?: 2 | 4;
  signed?: boolean;
  className?: string;
}) {
  const text = formatDecimal(value, { scale: dp, signed });
  if (text === "N/A") return <Missing />;
  const display = text.startsWith("-") ? `-₹${text.slice(1)}` : text.startsWith("+") ? `+₹${text.slice(1)}` : `₹${text}`;
  return <span className={`${NUM} ${toneClass(text, signed)} ${className}`}>{display}</span>;
}

/** Percent given as a decimal string already in percent units ("25.00" -> "25.00%"). */
export function PercentDisplay({
  value,
  signed = false,
  className = "",
}: {
  value: string | null | undefined;
  signed?: boolean;
  className?: string;
}) {
  const text = formatDecimal(value, { scale: 2, signed });
  if (text === "N/A") return <Missing />;
  return <span className={`${NUM} ${toneClass(text, signed)} ${className}`}>{text}%</span>;
}

/** Units and share quantities, 4 dp. */
export function QuantityDisplay({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const text = formatDecimal(value, { scale: 4 });
  if (text === "N/A") return <Missing />;
  return <span className={`${NUM} ${className}`}>{text}</span>;
}

/** Date-only (YYYY-MM-DD) or timestamp (shown in IST). */
export function DateDisplay({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  if (!value) return <Missing />;
  const text = /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatCalendarDate(value) : formatTimestampIst(value);
  if (text === "-") return <Missing />;
  return (
    <time dateTime={value} className={`${NUM} ${className}`}>
      {text}
    </time>
  );
}

type BadgeTone = "pending" | "approved" | "awaiting" | "final" | "negative" | "muted";

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "pending",
  REQUESTED: "pending",
  DRAFT: "pending",
  IDEA: "muted",
  WATCHING: "approved",
  APPROVED: "approved",
  ACTIVE: "approved",
  active: "approved",
  AWAITING_NAV: "awaiting",
  FINALIZED: "final",
  EXECUTED: "final",
  SETTLED: "final",
  COMPLETED: "final",
  ACCEPTED: "final",
  REJECTED: "negative",
  INVALIDATED: "negative",
  suspended: "negative",
  removed: "muted",
  CANCELLED: "muted",
  REVOKED: "muted",
  EXPIRED: "muted",
  REVERSED: "negative",
  closed: "muted",
};

const TONE_CLASS: Record<BadgeTone, string> = {
  pending: "border-[var(--qf-brass)]/50 bg-[var(--qf-brass)]/10 text-[var(--qf-brass-dark)]",
  approved: "border-[var(--qf-fix)]/40 bg-[var(--qf-fix-bg)] text-[var(--qf-fix)]",
  awaiting: "border-dashed border-[var(--qf-brass)] bg-transparent text-[var(--qf-brass-dark)]",
  final: "border-[var(--qf-up)]/40 bg-[var(--qf-up)]/15 text-[var(--qf-up)]",
  negative: "border-[var(--qf-down)]/40 bg-[var(--qf-down)]/10 text-[var(--qf-down)]",
  muted: "border-[var(--qf-line)] bg-[var(--qf-cream-1)] text-[var(--qf-ink-soft)]",
};

const STATUS_LABEL: Record<string, string> = {
  AWAITING_NAV: "Awaiting NAV",
  PENDING: "Pending approval",
};

/** Status is always spelled out in words; colour and border style only reinforce it. */
export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return <Missing />;
  const tone = STATUS_TONE[status] ?? "muted";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold leading-5 ${TONE_CLASS[tone]}`}>
      {label ?? STATUS_LABEL[status] ?? humanize(status)}
    </span>
  );
}

/** Market-data freshness. Unavailable, delayed and stale data are labelled, never hidden. */
export function QualityBadge({ quality, stale = false }: { quality: string | null | undefined; stale?: boolean }) {
  const q = quality ?? "UNAVAILABLE";
  const text: Record<string, string> = {
    LIVE: "Live",
    DELAYED: "Delayed",
    EOD: "End of day",
    MANUAL: "Manual",
    UNAVAILABLE: "Price unavailable",
  };
  const tone: BadgeTone = q === "UNAVAILABLE" || stale ? "negative" : q === "LIVE" || q === "EOD" ? "final" : "pending";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASS[tone]}`}>
      {text[q] ?? humanize(q)}
      {stale && q !== "UNAVAILABLE" ? " · stale" : ""}
    </span>
  );
}
