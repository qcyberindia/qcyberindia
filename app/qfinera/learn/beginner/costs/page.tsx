import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Receipt, Percent, ScrollText } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import LearningSection from "@/components/qfinance/learning/LearningSection";
import ConceptReveal from "@/components/qfinance/learning/ConceptReveal";
import NextCuriosity from "@/components/qfinance/learning/NextCuriosity";
import ProgressTracker from "@/components/qfinance/learning/ProgressTracker";
import Reveal from "@/components/Reveal";
import { getChapter, getAdjacentChapters } from "@/lib/qfinance-chapters";

const chapter = getChapter("costs")!;
const { prev, next } = getAdjacentChapters("costs");

export const metadata: Metadata = {
  title: chapter.title,
  description: chapter.description,
  alternates: { canonical: "/qfinera/learn/beginner/costs" },
};

function IconVisual({ Icon }: { Icon: typeof Receipt }) {
  return (
    <div className="flex h-36 items-center justify-center rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)]">
      <Icon size={40} strokeWidth={1.4} className="text-[var(--qf-brass)]" />
    </div>
  );
}

export default function ChapterCostsPage() {
  return (
    <div>
      <ProgressTracker slug="costs" />
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
              The amount you spend isn&apos;t the amount that leaves your account.
            </h1>
          </Reveal>
        </div>
      </section>

      <LearningSection eyebrow="The obvious one" question="What's brokerage?">
        <IconVisual Icon={Receipt} />
        <p>
          <strong className="text-[var(--qf-ink)]">Brokerage</strong> is the fee your broker charges for
          executing your order. Many apps advertise ₹0 or flat-fee brokerage on certain trade types - but
          brokerage is rarely the only charge on a trade.
        </p>
      </LearningSection>

      <LearningSection eyebrow="The one nobody advertises" question="What else gets deducted?">
        <IconVisual Icon={Percent} />
        <p>A single trade can involve several small charges beyond brokerage, including:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-[var(--qf-ink)]">STT</strong> (Securities Transaction Tax) - a government tax on the trade itself.</li>
          <li><strong className="text-[var(--qf-ink)]">Exchange transaction charges</strong> - a small fee the exchange takes.</li>
          <li><strong className="text-[var(--qf-ink)]">GST</strong> - charged on brokerage and some other fees.</li>
          <li><strong className="text-[var(--qf-ink)]">SEBI turnover fee</strong>, <strong className="text-[var(--qf-ink)]">stamp duty</strong>, and <strong className="text-[var(--qf-ink)]">DP charges</strong> (when you sell, for moving shares out of your Demat account).</li>
        </ul>
        <ConceptReveal prompt="Do I pay all of these on every single trade?">
          <p>
            Most of these apply on most trades, in small amounts - individually tiny, but they add up, and
            some (like STT) differ depending on whether you&apos;re buying or selling, and what you&apos;re
            trading. Exact rates change over time and vary by broker and trade type, so always check your
            broker&apos;s actual contract note rather than assuming a flat number.
          </p>
        </ConceptReveal>
      </LearningSection>

      <LearningSection eyebrow="Why it matters" question="Why should a beginner care about small charges?">
        <IconVisual Icon={ScrollText} />
        <p>
          On a single trade, these charges are usually small. But if you trade frequently, they compound -
          and more importantly, they mean your break-even point isn&apos;t the price you paid. A share needs
          to rise by slightly more than 0% just to cover what you paid in charges before you&apos;re actually
          in profit.
        </p>
        <p className="text-[13.5px] italic text-[var(--qf-ink-soft)]">
          This isn&apos;t a reason to avoid investing - it&apos;s a reason to read your contract note, not
          just the headline &ldquo;zero brokerage&rdquo; claim.
        </p>
      </LearningSection>

      <LearningSection eyebrow="Put together" question="">
        <div className="rounded-md border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/[0.06] p-5">
          <div className="flex items-start gap-3">
            <Receipt size={22} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" />
            <p className="text-[15px] leading-relaxed text-[var(--qf-ink)]">
              Brokerage is just one line item. Taxes, exchange fees, and small statutory charges also apply
              to most trades. None of them are hidden - they&apos;re all listed on the contract note your
              broker generates for every trade - but they&apos;re easy to miss if you never open it.
            </p>
          </div>
        </div>
      </LearningSection>

      <LearningSection tight>
        <NextCuriosity
          prompt="How do I tell a real opportunity from a scam?"
          cta={next ? `Explore Chapter ${next.number} - ${next.title} \u2192` : "Continue \u2192"}
          href={next ? `/qfinera/learn/beginner/${next.slug}` : "/qfinera/learn/beginner"}
        />

        <div className="mt-6 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">Still confused?</p>
          <p className="mt-1.5 font-display text-[15px] font-semibold text-[var(--qf-ink)]">Ask the QFinera community.</p>
          <Link
            href="/qfinera/community"
            className="mt-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline"
          >
            Explore Community
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-8 flex items-center justify-between text-sm">
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
