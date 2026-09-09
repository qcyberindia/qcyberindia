"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck, Landmark, Wallet, Receipt, Lock, PieChart, FlaskConical, Compass } from "lucide-react";
import type { Chapter } from "@/lib/qfinance-chapters";
import { getVisitedSlugs, getServerVisitedSlugs, subscribeToProgress } from "@/lib/qfinance-progress";

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

// Phase grouping for the Fear → Understanding → Confidence arc (Section 10).
// Keyed by chapter array index (0-based) — the label renders as a divider
// immediately above that chapter. Note: the source brief's Section 6
// diagram implied a 1–4 / 5–8 split, while its own Section 10 explicitly
// specified 1–2 / 3–6 / 7–8. Those two groupings conflict; this uses the
// more specific Section 10 mapping rather than silently picking one without
// flagging the discrepancy (recorded in qfinance.md).
const PHASE_LABELS: Record<number, string> = {
  0: "Fear",
  2: "Understanding",
  6: "Confidence",
};

/**
 * Vertical timeline presentation of the Beginner Journey (Phase 3 redesign —
 * replaces the chapter-card grid). Plain CSS connector (a thin line between
 * dots), no SVG path animation, no scroll-triggered motion beyond the
 * existing Reveal fade already used across QFinance.
 */
export default function JourneyTimeline({ chapters }: { chapters: Chapter[] }) {
  // useSyncExternalStore, not useState+useEffect: localStorage-derived
  // progress is externally-owned state, and this is React's sanctioned way
  // to read it — correctly reconciles the SSR snapshot (always empty, since
  // the server can't see localStorage) against the real client value right
  // after hydration, without a set-state-in-effect and without a hydration
  // mismatch warning.
  const visited = useSyncExternalStore(subscribeToProgress, getVisitedSlugs, getServerVisitedSlugs);

  // "Current" = first not-yet-visited chapter, so the journey has a single
  // clear next step. Falls back to the first chapter if none visited yet.
  const currentSlug = chapters.find((c) => !visited.includes(c.slug))?.slug ?? chapters[0].slug;

  return (
    <div>
      {chapters.map((chapter, i) => {
        const isLast = i === chapters.length - 1;
        const isVisited = visited.includes(chapter.slug);
        const isCurrent = !isVisited && chapter.slug === currentSlug;
        const Icon = ICONS[chapter.slug] ?? ShieldCheck;

        return (
          <div key={chapter.id}>
            {PHASE_LABELS[i] && (
              <div className={`flex items-center gap-3 pl-12 sm:pl-14 ${i === 0 ? "pb-5" : "pb-5 pt-1"}`}>
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--qf-brass-dark)]">
                  {PHASE_LABELS[i]}
                </span>
                <span className="h-px flex-1 bg-[var(--qf-line)]" aria-hidden />
              </div>
            )}
            <div className="flex gap-4 sm:gap-6">
            {/* Connector column */}
            <div className="flex w-8 shrink-0 flex-col items-center sm:w-10">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold ${
                  isVisited
                    ? "border-[var(--qf-brass)] bg-[var(--qf-brass)] text-[var(--qf-cream-0)]"
                    : isCurrent
                    ? "border-[var(--qf-brass)] bg-[var(--qf-cream-0)] text-[var(--qf-brass-dark)] ring-4 ring-[var(--qf-brass)]/15"
                    : "border-[var(--qf-line)] bg-[var(--qf-cream-0)] text-[var(--qf-ink-soft)]"
                }`}
              >
                {isVisited ? <Check size={14} /> : chapter.number}
              </div>
              {!isLast && (
                <div
                  className={`w-px flex-1 ${isVisited ? "bg-[var(--qf-brass)]" : "bg-[var(--qf-line)]"}`}
                  aria-hidden
                />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 ${isLast ? "pb-0" : "pb-10"}`}>
              <Link
                href={`/qfinance/learn/beginner/${chapter.slug}`}
                className={`group block rounded-md border p-5 transition-colors ${
                  isCurrent
                    ? "border-[var(--qf-brass)] bg-[var(--qf-cream-1)]"
                    : "border-[var(--qf-line)] bg-[var(--qf-cream-1)] hover:border-[var(--qf-brass)]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Icon size={17} className="text-[var(--qf-brass)]" />
                    <h3 className="font-display text-lg font-semibold text-[var(--qf-ink)]">{chapter.title}</h3>
                  </div>
                  {!chapter.ready && (
                    <span className="shrink-0 rounded-full border border-[var(--qf-line)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--qf-ink-soft)]">
                      Soon
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[14px] italic text-[var(--qf-ink-soft)]">&ldquo;{chapter.question}&rdquo;</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--qf-ink-soft)]">{chapter.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11.5px] font-medium text-[var(--qf-ink-soft)]">
                    ~{chapter.estMinutes} min
                  </span>
                  <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--qf-brass-dark)]">
                    {isVisited ? "Revisit" : isCurrent ? "Start here" : "Continue"}
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
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
