import type { Metadata } from "next";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import JourneyTimeline from "@/components/qfinance/learning/JourneyTimeline";
import ScrollToJourney from "@/components/qfinance/learning/ScrollToJourney";
import Reveal from "@/components/Reveal";
import { chapters } from "@/lib/qfinance-chapters";

export const metadata: Metadata = {
  title: "Beginner Journey",
  description:
    "You don't need to know everything about investing. Start with one question.",
  alternates: { canonical: "/qfinance/learn/beginner" },
};

export default function BeginnerJourneyMapPage() {
  return (
    <div>
      <QFinanceHeader />

      {/* Beginner Journey introduction */}
      <section className="relative border-b border-[var(--qf-line)] px-6 py-12 pb-20 sm:py-14 sm:pb-20">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">
              Beginner Journey
            </p>

            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--qf-ink)] sm:text-4xl">
              You don&apos;t need to know everything about investing.
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--qf-ink-soft)] sm:text-[17px]">
              Start with one question. Each chapter takes a few minutes and
              teaches one idea.
            </p>

            <div
              className="mt-5 flex items-center justify-center gap-3 text-sm font-medium text-[var(--qf-ink-soft)]"
              aria-label="Journey from fear to understanding to confidence"
            >
              <span>Fear</span>
              <ArrowLine />
              <span>Understanding</span>
              <ArrowLine />
              <span className="text-[var(--qf-brass-dark)]">Confidence</span>
            </div>
          </Reveal>
        </div>

        <ScrollToJourney targetId="journey" label="Scroll to begin" />
      </section>

      {/* Journey timeline */}
      <section
        id="journey"
        className="scroll-mt-6 px-6 py-12 sm:py-16"
      >
        <div className="mx-auto max-w-xl">
          <Reveal>
            <JourneyTimeline chapters={chapters} />
          </Reveal>
        </div>
      </section>

      <QFinanceFooter />
    </div>
  );
}

function ArrowLine() {
  return (
    <span
      aria-hidden="true"
      className="h-px w-6 bg-[var(--qf-line)]"
    />
  );
}