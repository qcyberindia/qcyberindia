"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Landmark,
  Wallet,
  Receipt,
  Lock,
  PieChart,
  FlaskConical,
  Compass,
} from "lucide-react";
import type { Chapter } from "@/lib/qfinance-chapters";
import {
  getVisitedSlugs,
  getServerVisitedSlugs,
  subscribeToProgress,
} from "@/lib/qfinance-progress";

const ICONS: Record<string, typeof ShieldCheck> = {
  safety: ShieldCheck,
  market: Landmark,
  accounts: Wallet,
  costs: Receipt,
  risk: Lock,
  "what-to-buy": PieChart,
  practice: FlaskConical,
  "next-step": Compass,
};

// Phase grouping for the Fear → Understanding → Confidence arc.
// Keyed by chapter array index (0-based).
const PHASE_LABELS: Record<number, string> = {
  0: "Fear",
  2: "Understanding",
  6: "Confidence",
};

/**
 * Vertical timeline presentation of the Beginner Journey.
 *
 * The timeline intentionally remains a simple connected journey rather
 * than a conventional card grid. Progress is local-only and never gates
 * access to any chapter.
 */
export default function JourneyTimeline({
  chapters,
}: {
  chapters: Chapter[];
}) {
  const visited = useSyncExternalStore(
    subscribeToProgress,
    getVisitedSlugs,
    getServerVisitedSlugs,
  );

  // Current = first chapter the learner has not yet visited.
  // If everything has been visited, return to the first chapter.
  const currentSlug =
    chapters.find((chapter) => !visited.includes(chapter.slug))?.slug ??
    chapters[0]?.slug;

  return (
    <div>
      {chapters.map((chapter, i) => {
        const isLast = i === chapters.length - 1;
        const isVisited = visited.includes(chapter.slug);
        const isCurrent =
          !isVisited && chapter.slug === currentSlug;
        const Icon = ICONS[chapter.slug] ?? ShieldCheck;

        return (
          <div key={chapter.id}>
            {/* Phase divider */}
            {PHASE_LABELS[i] && (
              <div
                className={`flex items-center gap-3 pl-12 sm:pl-14 ${
                  i === 0 ? "pb-4" : "pb-4 pt-1"
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--qf-brass-dark)]">
                  {PHASE_LABELS[i]}
                </span>

                <span
                  className="h-px flex-1 bg-[var(--qf-line)]"
                  aria-hidden="true"
                />
              </div>
            )}

            <div className="flex gap-4 sm:gap-6">
              {/* Connector column */}
              <div className="flex w-8 shrink-0 flex-col items-center sm:w-10">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold sm:h-10 sm:w-10 ${
                    isVisited
                      ? "border-[var(--qf-brass)] bg-[var(--qf-brass)] text-[var(--qf-cream-0)]"
                      : isCurrent
                        ? "border-[var(--qf-brass)] bg-[var(--qf-cream-0)] text-[var(--qf-brass-dark)] ring-4 ring-[var(--qf-brass)]/15"
                        : "border-[var(--qf-line)] bg-[var(--qf-cream-0)] text-[var(--qf-ink-soft)]"
                  }`}
                  aria-label={
                    isVisited
                      ? `Chapter ${chapter.number} completed`
                      : `Chapter ${chapter.number}`
                  }
                >
                  {isVisited ? (
                    <Check size={15} strokeWidth={2.5} />
                  ) : (
                    chapter.number
                  )}
                </div>

                {!isLast && (
                  <div
                    className={`w-px flex-1 ${
                      isVisited
                        ? "bg-[var(--qf-brass)]"
                        : "bg-[var(--qf-line)]"
                    }`}
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Chapter content */}
              <div
                className={`flex-1 ${
                  isLast ? "pb-0" : "pb-8 sm:pb-9"
                }`}
              >
                <Link
                  href={`/qfinance/learn/beginner/${chapter.slug}`}
                  className={`group block rounded-md border p-5 sm:p-6 transition-colors ${
                    isCurrent
                      ? "border-[var(--qf-brass)] bg-[var(--qf-cream-1)]"
                      : "border-[var(--qf-line)] bg-[var(--qf-cream-1)] hover:border-[var(--qf-brass)]"
                  }`}
                >
                  {/* Chapter heading */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon
                        size={18}
                        className="shrink-0 text-[var(--qf-brass)]"
                        aria-hidden="true"
                      />

                      <h3 className="font-display text-lg font-semibold leading-snug text-[var(--qf-ink)] sm:text-xl">
                        {chapter.title}
                      </h3>
                    </div>

                    {!chapter.ready && (
                      <span className="shrink-0 rounded-full border border-[var(--qf-line)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--qf-ink-soft)]">
                        Soon
                      </span>
                    )}
                  </div>

                  {/* Chapter question */}
                  <p className="mt-2 text-[15px] italic leading-relaxed text-[var(--qf-ink-soft)]">
                    &ldquo;{chapter.question}&rdquo;
                  </p>

                  {/* Chapter description */}
                  <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--qf-ink-soft)] sm:text-[15px]">
                    {chapter.description}
                  </p>

                  {/* Chapter metadata / CTA */}
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-[var(--qf-ink-soft)]">
                      ~{chapter.estMinutes} min
                    </span>

                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--qf-brass-dark)]">
                      {isVisited
                        ? "Revisit"
                        : isCurrent
                          ? "Start here"
                          : "Continue"}

                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}