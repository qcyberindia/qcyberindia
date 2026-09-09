import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck, PieChart, KeyRound, Landmark } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import LearningSection from "@/components/qfinance/learning/LearningSection";
import ConceptReveal from "@/components/qfinance/learning/ConceptReveal";
import NextCuriosity from "@/components/qfinance/learning/NextCuriosity";
import ProgressTracker from "@/components/qfinance/learning/ProgressTracker";
import Reveal from "@/components/Reveal";
import { getChapter, getAdjacentChapters } from "@/lib/qfinance-chapters";

const chapter = getChapter("safety")!;
const { prev, next } = getAdjacentChapters("safety");

export const metadata: Metadata = {
  title: chapter.title,
  description: chapter.description,
  alternates: { canonical: "/qfinance/learn/beginner/safety" },
};

function IconVisual({ Icon }: { Icon: typeof ShieldCheck }) {
  return (
    <div className="flex h-36 items-center justify-center rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)]">
      <Icon size={40} strokeWidth={1.4} className="text-[var(--qf-brass)]" />
    </div>
  );
}

export default function ChapterSafetyPage() {
  return (
    <div>
      <ProgressTracker slug="safety" />
      <QFinanceHeader />

      {/* Chapter header + progress — consistent chrome every chapter reuses */}
      <div className="border-b border-[var(--qf-line)] px-6 py-6">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <Link
            href="/qfinance/learn/beginner"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--qf-ink-soft)] hover:text-[var(--qf-brass-dark)]"
          >
            <ArrowLeft size={13} />
            Journey Map
          </Link>
          <p className="text-[13px] font-semibold text-[var(--qf-brass)]">
            Chapter {chapter.number} of 08
          </p>
        </div>
      </div>

      <section className="px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">
              {chapter.title}
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-4xl">
              Before you invest, understand what you&apos;re buying.
            </h1>
          </Reveal>
        </div>
      </section>

      {/* Screen 2 — What is a share? */}
      <LearningSection eyebrow="One idea at a time" question="What is a share?">
        <IconVisual Icon={PieChart} />
        <p>
          A share is a small, tradeable piece of a company — a security that represents an ownership
          interest, not a physical object you can hold.
        </p>
        <ConceptReveal prompt="Why does a company sell shares in the first place?">
          <p>
            Companies raise money by selling shares to investors so they can grow — build factories, hire
            people, expand. In exchange, shareholders get an ownership interest in the company.
          </p>
        </ConceptReveal>
      </LearningSection>

      {/* Screen 3 — Does owning one share mean owning something? */}
      <LearningSection eyebrow="Ownership" question="Does owning one share actually mean owning something?">
        <IconVisual Icon={Landmark} />
        <p>
          Yes — but a proportionally tiny piece. If a company has 10 crore shares and you own 10, you hold
          a very small fraction of that company&apos;s ownership.
        </p>
        <p>
          The specific rights that come with a share — voting, dividends, and so on — depend on the type of
          security and the applicable rules, not on how it feels to hold it.
        </p>
      </LearningSection>

      {/* Screen 4 — Can a company disappear from my Demat account? */}
      <LearningSection eyebrow="Where it's recorded" question="Can a company disappear from my Demat account?">
        <IconVisual Icon={KeyRound} />
        <p>
          Your ownership isn&apos;t a paper certificate sitting in a drawer — it&apos;s an electronic record
          held in your Demat account. That record doesn&apos;t vanish because a share&apos;s price falls.
        </p>
        <ConceptReveal prompt="So what actually changes when the price moves?">
          <p>
            The <em>market value</em> of your holding changes — what the market is currently willing to pay
            for it. The <em>ownership record</em> — how many shares you hold — stays exactly the same unless
            you buy or sell.
          </p>
        </ConceptReveal>
      </LearningSection>

      {/* Screen 5 — Aha moment */}
      <LearningSection eyebrow="Put together" question="">
        <div className="rounded-md border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/[0.06] p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck size={22} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" />
            <p className="text-[15px] leading-relaxed text-[var(--qf-ink)]">
              A share represents a security — an ownership interest — recorded electronically in your
              Demat account. The market price can rise or fall without your ownership record disappearing,
              because those are two different things: what you own, and what it&apos;s currently worth.
            </p>
          </div>
        </div>
      </LearningSection>

      {/* Screen 6 — Next curiosity */}
      <LearningSection tight>
        <NextCuriosity
          prompt="But who am I actually buying from?"
          cta={next ? `Explore Chapter ${next.number} — ${next.title} →` : "Continue →"}
          href={next ? `/qfinance/learn/beginner/${next.slug}` : "/qfinance/learn/beginner"}
        />

        <div className="mt-6 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">
            Still confused?
          </p>
          <p className="mt-1.5 font-display text-[15px] font-semibold text-[var(--qf-ink)]">
            Ask the QFinance community.
          </p>
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
