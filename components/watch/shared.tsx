// Shared labels and small pieces for Global Watch. No client state.
import Link from "next/link";
import { FileText, Film, Link2, Newspaper } from "lucide-react";
import type { WatchItemDto } from "@/components/fund/api";

export const CATEGORY_LABEL: Record<string, string> = {
  STOCK: "Stocks",
  INDUSTRY: "Industry",
  ECONOMY: "Economy",
  NEWS: "News",
  RESEARCH: "Research",
  RISK: "Risk",
  OPPORTUNITY: "Opportunity",
  REGULATORY: "Regulatory",
  OTHER: "Other",
};

export const CATEGORY_HINT: Record<string, string> = {
  STOCK: "A specific company or listed stock",
  INDUSTRY: "A sector-wide development",
  ECONOMY: "Rates, inflation, policy, macro data",
  NEWS: "An announcement or news report",
  RESEARCH: "An article, report or analysis worth reading",
  RISK: "Something that could go wrong",
  OPPORTUNITY: "Something worth a closer look",
  REGULATORY: "SEBI, RBI, tax or other rules",
  OTHER: "Anything else useful",
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL);

export const LINK_KIND_LABEL: Record<string, string> = { ARTICLE: "Article", VIDEO: "Video", DOCUMENT: "Document", OTHER: "Link" };
export const LINK_ICON = { ARTICLE: Newspaper, VIDEO: Film, DOCUMENT: FileText, OTHER: Link2 } as const;

export function CategoryTag({ category }: { category: string }) {
  const warn = category === "RISK";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
        warn ? "bg-[var(--qf-down)]/10 text-[var(--qf-down)]" : "bg-[var(--qf-brass)]/12 text-[var(--qf-brass-dark)]"
      }`}
    >
      {CATEGORY_LABEL[category] ?? category}
    </span>
  );
}

export function relativeDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

export function WatchCard({ item }: { item: WatchItemDto }) {
  const subject = [item.symbol, item.company].filter(Boolean).join(" · ") || item.industry;
  return (
    <li>
      <Link
        href={`/qfinera/watch/${item.id}`}
        className="group block h-full rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4 transition-colors hover:border-[var(--qf-brass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)] sm:p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <CategoryTag category={item.category} />
          {item.priority === "HIGH" && <span className="text-[11.5px] font-semibold text-[var(--qf-ink)]">High priority</span>}
          {item.status === "ARCHIVED" && <span className="text-[11.5px] font-semibold text-[var(--qf-ink-soft)]">Archived</span>}
        </div>
        <h2 className="mt-2 font-display text-[17px] font-semibold leading-snug text-[var(--qf-ink)] group-hover:underline group-hover:underline-offset-2">
          {item.title}
        </h2>
        {subject && <p className="mt-0.5 text-[13px] font-medium text-[var(--qf-ink-soft)]">{subject}</p>}
        <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-[var(--qf-ink)]">{item.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[var(--qf-ink-soft)]">
          <span>{item.authorName ?? "A member"}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={item.createdAt}>{relativeDate(item.createdAt)}</time>
          {item.links.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {item.links.length} link{item.links.length === 1 ? "" : "s"}
              </span>
            </>
          )}
          {item.attachmentCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {item.attachmentCount} file{item.attachmentCount === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>
        {item.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
            {item.tags.map((t) => (
              <li key={t} className="rounded border border-[var(--qf-line)] px-1.5 py-0.5 text-[11.5px] text-[var(--qf-ink-soft)]">
                #{t}
              </li>
            ))}
          </ul>
        )}
      </Link>
    </li>
  );
}
