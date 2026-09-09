import type { Metadata } from "next";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import JourneyTimeline from "@/components/qfinance/learning/JourneyTimeline";
import Reveal from "@/components/Reveal";
import { chapters } from "@/lib/qfinance-chapters";

export const metadata: Metadata = {
  title: "Beginner Journey",
  description: "You Don&apos;t need to know everything about investing. Start with one question.",
  alternates: { canonical: "/qfinance/learn/beginner" },
};

export default function BeginnerJourneyMapPage() {
  return (
    <div>
      <QFinanceHeader />

      <section className="border-b border-[var(--qf-line)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">
              Beginner Journey
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--qf-ink)] sm:text-4xl">
              You don&apos;t need to know everything about investing.
            </h1>
            <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              Start with one question. Each chapter takes a few minutes and teaches one idea.
            </p>
            <p className="mt-5 flex items-center justify-center gap-3 text-[13px] font-medium text-[var(--qf-ink-soft)]">
              <span>Fear</span>
              <ArrowLine />
              <span>Understanding</span>
              <ArrowLine />
              <span className="text-[var(--qf-brass-dark)]">Confidence</span>
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-14 sm:py-20">
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
  return <span aria-hidden className="h-px w-6 bg-[var(--qf-line)]" />;
}
