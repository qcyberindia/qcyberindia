import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Chapter } from "@/lib/qfinance-chapters";

export default function ChapterCard({ chapter }: { chapter: Chapter }) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-semibold text-[var(--qf-brass)]">{chapter.number}</p>
        {!chapter.ready && (
          <span className="rounded-full border border-[var(--qf-line)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--qf-ink-soft)]">
            Soon
          </span>
        )}
      </div>
      <h3 className="mt-2.5 font-display text-lg font-semibold text-[var(--qf-ink)]">{chapter.title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--qf-ink-soft)]">{chapter.description}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-[11.5px] font-medium text-[var(--qf-ink-soft)]">
          ~{chapter.estMinutes} min
        </span>
        {chapter.ready && (
          <span className="inline-flex items-center gap-1 font-display text-[13px] font-semibold text-[var(--qf-brass-dark)]">
            Start
            <ArrowRight size={13} />
          </span>
        )}
      </div>
    </>
  );

  const className =
    "block rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 transition-colors hover:border-[var(--qf-brass)]";

  if (!chapter.ready) {
    return (
      <div className={`${className} opacity-70`} aria-disabled>
        {content}
      </div>
    );
  }

  return (
    <Link href={`/qfinance/learn/beginner/${chapter.slug}`} className={className}>
      {content}
    </Link>
  );
}
