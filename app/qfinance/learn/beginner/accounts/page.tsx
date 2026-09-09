import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Wallet, ArrowRightLeft, Vault } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import LearningSection from "@/components/qfinance/learning/LearningSection";
import ConceptReveal from "@/components/qfinance/learning/ConceptReveal";
import NextCuriosity from "@/components/qfinance/learning/NextCuriosity";
import ProgressTracker from "@/components/qfinance/learning/ProgressTracker";
import Reveal from "@/components/Reveal";
import { getChapter, getAdjacentChapters } from "@/lib/qfinance-chapters";

const chapter = getChapter("accounts")!;
const { prev, next } = getAdjacentChapters("accounts");

export const metadata: Metadata = {
  title: chapter.title,
  description: chapter.description,
  alternates: { canonical: "/qfinance/learn/beginner/accounts" },
};

function IconVisual({ Icon }: { Icon: typeof Wallet }) {
  return (
    <div className="flex h-36 items-center justify-center rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)]">
      <Icon size={40} strokeWidth={1.4} className="text-[var(--qf-brass)]" />
    </div>
  );
}

export default function ChapterAccountsPage() {
  return (
    <div>
      <ProgressTracker slug="accounts" />
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
              Three accounts, three different jobs.
            </h1>
          </Reveal>
        </div>
      </section>

      <LearningSection eyebrow="The one you already know" question="What does your bank account do here?">
        <IconVisual Icon={Wallet} />
        <p>
          Your <strong className="text-[var(--qf-ink)]">bank account</strong> holds your actual cash. When
          you buy shares, money leaves here; when you sell, money lands back here. It never holds shares
          themselves.
        </p>
      </LearningSection>

      <LearningSection eyebrow="The order-taker" question="What's a trading account, then?">
        <IconVisual Icon={ArrowRightLeft} />
        <p>
          Your <strong className="text-[var(--qf-ink)]">trading account</strong> is what your broker uses to
          place and track your buy/sell orders on the exchange. Think of it as the account that does the
          transacting - it doesn&apos;t store cash long-term or hold your shares either.
        </p>
        <ConceptReveal prompt="So what actually holds the shares I own?">
          <p>Neither of the above - that&apos;s the third account.</p>
        </ConceptReveal>
      </LearningSection>

      <LearningSection eyebrow="Where ownership lives" question="What is a Demat account?">
        <IconVisual Icon={Vault} />
        <p>
          Your <strong className="text-[var(--qf-ink)]">Demat (dematerialized) account</strong> is where your
          shares are actually held, electronically - the same way a bank statement records how much money
          you have, a Demat account records how many shares you own, of what, and since when.
        </p>
        <p>
          When a trade executes, shares move in or out of this account. It&apos;s the closest thing to a
          &ldquo;locker&rdquo; for what you own, except nothing physical ever sits inside it.
        </p>
      </LearningSection>

      <LearningSection eyebrow="Put together" question="">
        <div className="rounded-md border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/[0.06] p-5">
          <div className="flex items-start gap-3">
            <Vault size={22} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" />
            <p className="text-[15px] leading-relaxed text-[var(--qf-ink)]">
              Bank account: your cash. Trading account: where orders happen. Demat account: where your
              ownership is actually recorded. Money flows through the first two; what you own lives in
              the third.
            </p>
          </div>
        </div>
      </LearningSection>

      <LearningSection tight>
        <NextCuriosity
          prompt="Okay - so what does all this actually cost me?"
          cta={next ? `Explore Chapter ${next.number} - ${next.title} \u2192` : "Continue \u2192"}
          href={next ? `/qfinance/learn/beginner/${next.slug}` : "/qfinance/learn/beginner"}
        />

        <div className="mt-6 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">Still confused?</p>
          <p className="mt-1.5 font-display text-[15px] font-semibold text-[var(--qf-ink)]">Ask the QFinance community.</p>
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
