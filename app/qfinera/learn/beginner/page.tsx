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
  alternates: { canonical: "/qfinera/learn/beginner" },
};

export default function BeginnerJourneyMapPage() {
  return (
    <div>
      <QFinanceHeader />

      {/* Beginner Journey introduction */}
      <section className="border-b border-[var(--qf-line)] px-6 py-12 pb-10 sm:py-14 sm:pb-12">
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
              className="mx-auto mt-8 w-full max-w-2xl"
              aria-label="Journey from fear to understanding to confidence"
            >
              <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start">
                <div className="text-center">
                  <div className="text-[10px] font-medium tracking-[0.16em] text-[var(--qf-ink-muted)]">
                    01
                  </div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--qf-ink-soft)]">
                    Fear
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--qf-ink-muted)]">
                    What feels uncertain
                  </p>
                </div>

                <div
                  aria-hidden="true"
                  className="mt-4 h-px w-8 bg-[var(--qf-line)] sm:w-12"
                />

                <div className="text-center">
                  <div className="text-[10px] font-medium tracking-[0.16em] text-[var(--qf-ink-muted)]">
                    02
                  </div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--qf-ink-soft)]">
                    Understanding
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--qf-ink-muted)]">
                    What starts making sense
                  </p>
                </div>

                <div
                  aria-hidden="true"
                  className="mt-4 h-px w-8 bg-[var(--qf-line)] sm:w-12"
                />

                <div className="text-center">
                  <div className="text-[10px] font-medium tracking-[0.16em] text-[var(--qf-brass-dark)]">
                    03
                  </div>
                  <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--qf-brass-dark)]">
                    Confidence
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--qf-ink-muted)]">
                    What you can now do
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <ScrollToJourney targetId="journey" label="Begin the journey" />
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
