import Link from "next/link";

const CATEGORIES = [
  "Getting Started",
  "Stocks",
  "Mutual Funds & ETFs",
  "Markets",
  "Risk & Safety",
  "Costs & Taxes",
  "Apps & Accounts",
  "General",
] as const;

/** Plain links with the category in the query string — a Server Component,
 * no client-side state needed, works without JS. */
export default function CategoryFilter({ active }: { active?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/qfinance/community"
        className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
          !active
            ? "border-[var(--qf-brass)] bg-[var(--qf-brass)]/10 text-[var(--qf-brass-dark)]"
            : "border-[var(--qf-line)] text-[var(--qf-ink-soft)] hover:border-[var(--qf-brass)]"
        }`}
      >
        All
      </Link>
      {CATEGORIES.map((c) => (
        <Link
          key={c}
          href={`/qfinance/community?category=${encodeURIComponent(c)}`}
          className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
            active === c
              ? "border-[var(--qf-brass)] bg-[var(--qf-brass)]/10 text-[var(--qf-brass-dark)]"
              : "border-[var(--qf-line)] text-[var(--qf-ink-soft)] hover:border-[var(--qf-brass)]"
          }`}
        >
          {c}
        </Link>
      ))}
    </div>
  );
}
