import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, MessageCircleQuestion, Rocket } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import LearningSection from "@/components/qfinance/learning/LearningSection";
import ProgressTracker from "@/components/qfinance/learning/ProgressTracker";
import Reveal from "@/components/Reveal";
import { getChapter, getAdjacentChapters } from "@/lib/qfinance-chapters";

const chapter = getChapter("next-step")!;
const { prev } = getAdjacentChapters("next-step");

export const metadata: Metadata = {
  title: chapter.title,
  description: chapter.description,
  alternates: { canonical: "/qfinera/learn/beginner/next-step" },
};

const recap = [
  "What you actually own when you buy a share",
  "Who you're really buying from, and how an order gets matched",
  "What your bank, trading, and Demat accounts each do",
  "Why the amount you spend isn't the amount that leaves your account",
  "How to recognise a scam before it recognises you",
  "The difference between a stock, a mutual fund, an index fund, and an ETF",
  "What actually happens, step by step, when an order is placed",
];

export default function ChapterNextStepPage() {
  return (
    <div>
      <ProgressTracker slug="next-step" />
      <QFinanceHeader />

      <div className="border-b border-[var(--qf-line)] px-6 py-6">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link
            href="/qfinera/learn/beginner"
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
              Understanding comes first. Action comes second.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--qf-ink-soft)]">
              You started this journey asking whether investing was even safe. Here&apos;s what you&apos;ve
              actually covered since then.
            </p>
          </Reveal>
        </div>
      </section>

      <LearningSection eyebrow="What you now understand" question="">
        <ul className="space-y-2.5">
          {recap.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-[14.5px] text-[var(--qf-ink)]">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--qf-brass)]" />
              {item}
            </li>
          ))}
        </ul>
      </LearningSection>

      <LearningSection eyebrow="What this journey was not" question="">
        <p>
          Nothing in these eight chapters told you what to buy, when to buy it, or what kind of return to
          expect. That was deliberate. QFinera is educational — understanding how the mechanics work is a
          separate thing from deciding what, if anything, you personally should invest in, and that decision
          depends on your own circumstances, goals, and risk tolerance.
        </p>
      </LearningSection>

      <LearningSection eyebrow="Where to go next" question="">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5">
            <MessageCircleQuestion size={22} className="text-[var(--qf-brass)]" />
            <p className="mt-3 font-display text-[15px] font-semibold text-[var(--qf-ink)]">
              Still have a question?
            </p>
            <p className="mt-1.5 text-[13.5px] text-[var(--qf-ink-soft)]">
              Ask it in the QFinera community — other beginners are asking the same things.
            </p>
            <Link
              href="/qfinera/community"
              className="mt-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline"
            >
              Explore Community
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="rounded-md border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/[0.06] p-5">
            <Rocket size={22} className="text-[var(--qf-brass-dark)]" />
            <p className="mt-3 font-display text-[15px] font-semibold text-[var(--qf-ink)]">
              Want to help shape what&apos;s next?
            </p>
            <p className="mt-1.5 text-[13.5px] text-[var(--qf-ink-soft)]">
              QFinera is still early. Join the beta to get access as new tools are built.
            </p>
            <Link
              href="/qfinera/beta"
              className="mt-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline"
            >
              Join the Beta
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-[13.5px] text-[var(--qf-ink-soft)]">
          Or revisit anything from{" "}
          <Link href="/qfinera/learn/beginner" className="font-medium text-[var(--qf-brass-dark)] hover:underline">
            the Journey Map
          </Link>{" "}
          — it&apos;s always there, in the same order, whenever you need it again.
        </p>
      </LearningSection>

      <LearningSection tight>
        <div className="flex items-center justify-between text-sm">
          {prev ? (
            <Link href={`/qfinera/learn/beginner/${prev.slug}`} className="inline-flex items-center gap-1.5 text-[var(--qf-ink-soft)] hover:text-[var(--qf-brass-dark)]">
              <ArrowLeft size={13} />
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          <Link href="/qfinera/learn/beginner" className="text-[var(--qf-ink-soft)] hover:text-[var(--qf-brass-dark)]">
            Journey Map
          </Link>
        </div>
      </LearningSection>

      <QFinanceFooter />
    </div>
  );
}
