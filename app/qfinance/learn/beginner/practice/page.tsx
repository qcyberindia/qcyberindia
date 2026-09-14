import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, FlaskConical } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import LearningSection from "@/components/qfinance/learning/LearningSection";
import NextCuriosity from "@/components/qfinance/learning/NextCuriosity";
import ProgressTracker from "@/components/qfinance/learning/ProgressTracker";
import OrderSimulator from "@/components/qfinance/learning/OrderSimulator";
import Reveal from "@/components/Reveal";
import { getChapter, getAdjacentChapters } from "@/lib/qfinance-chapters";

const chapter = getChapter("practice")!;
const { prev, next } = getAdjacentChapters("practice");

export const metadata: Metadata = {
  title: chapter.title,
  description: chapter.description,
  alternates: { canonical: "/qfinance/learn/beginner/practice" },
};

export default function ChapterPracticePage() {
  return (
    <div>
      <ProgressTracker slug="practice" />
      <QFinanceHeader />

      <div className="border-b border-[var(--qf-line)] px-6 py-6">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link
            href="/qfinance/learn/beginner"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--qf-ink-soft)] hover:text-[var(--qf-brass-dark)]"
          >
            <ArrowLeft size={13} />
            Journey Map
          </Link>
          <p className="text-[13px] font-semibold text-[var(--qf-brass)]">Chapter {chapter.number} of 08</p>
        </div>
      </div>

      <section className="px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">{chapter.title}</p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-4xl">
              You&apos;ve read how an order works. Now watch one happen.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--qf-ink-soft)]">
              Everything below is simulated. No broker is connected, no order reaches a real exchange, and
              no money moves. It exists to make Chapters 02 and 03 concrete.
            </p>
          </Reveal>
        </div>
      </section>

      <LearningSection eyebrow="Try it" question="Place a simulated order and watch it move through the stages you already learned about.">
        <OrderSimulator />
      </LearningSection>

      <LearningSection eyebrow="What you just saw" question="">
        <div className="rounded-md border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/[0.06] p-5">
          <div className="flex items-start gap-3">
            <FlaskConical size={22} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" />
            <p className="text-[15px] leading-relaxed text-[var(--qf-ink)]">
              The same four stages from Chapter 02 — placed, sent to your broker, matched on the exchange,
              settled into your Demat account — just compressed into a few seconds instead of the moments
              (or longer) it can take in a real market waiting for a matching order. The simulated price and
              timing are illustrative, not real quotes.
            </p>
          </div>
        </div>
      </LearningSection>

      <LearningSection tight>
        <NextCuriosity
          prompt="You've seen the mechanics — what should you actually do with what you've learned?"
          cta={next ? `Explore Chapter ${next.number} — ${next.title} →` : "Continue →"}
          href={next ? `/qfinance/learn/beginner/${next.slug}` : "/qfinance/learn/beginner"}
        />

        <div className="mt-6 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">Still confused?</p>
          <p className="mt-1.5 font-display text-[15px] font-semibold text-[var(--qf-ink)]">Ask the QFinera community.</p>
          <Link
            href="/qfinance/community"
            className="mt-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline"
          >
            Explore Community
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-between text-sm">
          {prev ? (
            <Link href={`/qfinance/learn/beginner/${prev.slug}`} className="inline-flex items-center gap-1.5 text-[var(--qf-ink-soft)] hover:text-[var(--qf-brass-dark)]">
              <ArrowLeft size={13} />
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          <Link href="/qfinance/learn/beginner" className="text-[var(--qf-ink-soft)] hover:text-[var(--qf-brass-dark)]">
            Journey Map
          </Link>
        </div>
      </LearningSection>

      <QFinanceFooter />
    </div>
  );
}
