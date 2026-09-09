import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LineChart, Layers, Target } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import LearningSection from "@/components/qfinance/learning/LearningSection";
import ConceptReveal from "@/components/qfinance/learning/ConceptReveal";
import NextCuriosity from "@/components/qfinance/learning/NextCuriosity";
import ProgressTracker from "@/components/qfinance/learning/ProgressTracker";
import Reveal from "@/components/Reveal";
import { getChapter, getAdjacentChapters } from "@/lib/qfinance-chapters";

const chapter = getChapter("what-to-buy")!;
const { prev, next } = getAdjacentChapters("what-to-buy");

export const metadata: Metadata = {
  title: chapter.title,
  description: chapter.description,
  alternates: { canonical: "/qfinance/learn/beginner/what-to-buy" },
};

function IconVisual({ Icon }: { Icon: typeof LineChart }) {
  return (
    <div className="flex h-36 items-center justify-center rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)]">
      <Icon size={40} strokeWidth={1.4} className="text-[var(--qf-brass)]" />
    </div>
  );
}

export default function ChapterWhatToBuyPage() {
  return (
    <div>
      <ProgressTracker slug="what-to-buy" />
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
              This chapter won&apos;t tell you what to buy. It&apos;ll tell you what your options mean.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--qf-ink-soft)]">
              QFinance doesn&apos;t give personalized investment advice or recommend specific stocks. What
              it can do is make sure you understand the categories before you choose between them.
            </p>
          </Reveal>
        </div>
      </section>

      <LearningSection eyebrow="Direct ownership" question="What does buying an individual stock mean?">
        <IconVisual Icon={Target} />
        <p>
          A stock is ownership in <strong className="text-[var(--qf-ink)]">one specific company</strong>.
          Its value depends entirely on that company - how it performs, what happens in its industry,
          decisions its management makes. You&apos;re not spread across anything; you&apos;re exposed to
          one business.
        </p>
        <ConceptReveal prompt="Why would that be riskier than other options?">
          <p>
            Because nothing offsets it. If that one company does badly, there&apos;s nothing else in that
            specific holding cushioning the fall. Picking individual stocks well requires research most
            beginners haven&apos;t done yet - that&apos;s not a criticism, just a fact about how new most
            people are to this.
          </p>
        </ConceptReveal>
      </LearningSection>

      <LearningSection eyebrow="Pooled ownership" question="What's a mutual fund?">
        <IconVisual Icon={Layers} />
        <p>
          A mutual fund pools money from many investors and a fund manager decides how to spread it across
          many companies. Instead of owning one company, you own a small slice of a whole basket -
          spreading out, or <strong className="text-[var(--qf-ink)]">diversifying</strong>, your risk across
          many businesses at once.
        </p>
        <p>
          An <strong className="text-[var(--qf-ink)]">index fund</strong> is a specific, simpler type of
          mutual fund: instead of a manager actively picking companies, it just holds whatever a market
          index (like the Nifty 50) holds, in the same proportions. Less decision-making, generally lower
          fees.
        </p>
      </LearningSection>

      <LearningSection eyebrow="Traded like a stock" question="How is an ETF different from a mutual fund?">
        <IconVisual Icon={LineChart} />
        <p>
          An <strong className="text-[var(--qf-ink)]">ETF (exchange-traded fund)</strong> works a lot like an
          index fund - a basket of holdings, spreading your risk - but it trades on the exchange
          throughout the day, the same way an individual stock does, rather than being priced once at the
          end of the day like a typical mutual fund.
        </p>
        <ConceptReveal prompt="So which one is 'better' — stock, mutual fund, index fund, or ETF?">
          <p>
            There&apos;s no single right answer - it depends on how much risk you&apos;re comfortable
            with, how much time you want to spend researching, and what you&apos;re trying to achieve. This
            chapter&apos;s job is to make sure you understand what each category actually is, not to tell
            you which one to pick.
          </p>
        </ConceptReveal>
      </LearningSection>

      <LearningSection eyebrow="Put together" question="">
        <div className="rounded-md border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/[0.06] p-5">
          <div className="flex items-start gap-3">
            <Layers size={22} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" />
            <p className="text-[15px] leading-relaxed text-[var(--qf-ink)]">
              A stock is ownership in one company. A mutual fund and an index fund pool your money across
              many companies, priced once a day. An ETF does something similar but trades all day like a
              stock. Different structures, different risk and complexity - not one &ldquo;correct&rdquo;
              choice.
            </p>
          </div>
        </div>
      </LearningSection>

      <LearningSection tight>
        <NextCuriosity
          prompt="Can I see any of this in action without risking real money?"
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
