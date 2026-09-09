import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Repeat, Handshake } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import LearningSection from "@/components/qfinance/learning/LearningSection";
import ConceptReveal from "@/components/qfinance/learning/ConceptReveal";
import NextCuriosity from "@/components/qfinance/learning/NextCuriosity";
import ProgressTracker from "@/components/qfinance/learning/ProgressTracker";
import Reveal from "@/components/Reveal";
import { getChapter, getAdjacentChapters } from "@/lib/qfinance-chapters";

const chapter = getChapter("market")!;
const { prev, next } = getAdjacentChapters("market");

export const metadata: Metadata = {
  title: chapter.title,
  description: chapter.description,
  alternates: { canonical: "/qfinance/learn/beginner/market" },
};

function IconVisual({ Icon }: { Icon: typeof Building2 }) {
  return (
    <div className="flex h-36 items-center justify-center rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)]">
      <Icon size={40} strokeWidth={1.4} className="text-[var(--qf-brass)]" />
    </div>
  );
}

export default function ChapterMarketPage() {
  return (
    <div>
      <ProgressTracker slug="market" />
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
              You don&apos;t buy a share from the company that issued it.
            </h1>
          </Reveal>
        </div>
      </section>

      <LearningSection eyebrow="The most common misconception" question="Who am I actually buying from?">
        <IconVisual Icon={Handshake} />
        <p>
          When you buy a listed share, you&apos;re almost always buying it from{" "}
          <strong className="text-[var(--qf-ink)]">another investor who is selling</strong> - not from
          the company itself. The company already sold its shares once, when it first listed. After that,
          shares just change hands between investors.
        </p>
        <ConceptReveal prompt="So the company doesn't get my money when I buy its stock?">
          <p>
            Correct - in almost all everyday trading. The company received money only when it originally
            issued those shares. Day-to-day, you&apos;re trading with other people who already hold them, on
            what&apos;s called the <strong className="text-[var(--qf-ink)]">secondary market</strong>.
          </p>
        </ConceptReveal>
      </LearningSection>

      <LearningSection eyebrow="Where it happens" question="Where do buyers and sellers actually meet?">
        <IconVisual Icon={Building2} />
        <p>
          On an <strong className="text-[var(--qf-ink)]">exchange</strong> - in India, mainly the NSE or BSE.
          An exchange doesn&apos;t buy or sell anything itself; it&apos;s the marketplace where buy orders and
          sell orders are matched against each other.
        </p>
        <p>
          You don&apos;t place an order directly on the exchange, though. You place it through a{" "}
          <strong className="text-[var(--qf-ink)]">broker</strong> - the app or platform you signed up
          with - which is registered to send orders to the exchange on your behalf.
        </p>
      </LearningSection>

      <LearningSection eyebrow="The full path" question="What happens between tapping &ldquo;Buy&rdquo; and owning the share?">
        <IconVisual Icon={Repeat} />
        <p>Roughly, in order:</p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>You place a buy order with your broker.</li>
          <li>Your broker sends it to the exchange.</li>
          <li>The exchange looks for a matching sell order - from another investor.</li>
          <li>When a match is found, the trade executes at an agreed price.</li>
          <li>The share moves into your Demat account; the seller&apos;s moves out of theirs.</li>
        </ol>
        <ConceptReveal prompt="What if nobody wants to sell at my price right now?">
          <p>
            Then your order waits, unmatched, until a seller agrees to your price (or you agree to
            someone else&apos;s) - or you cancel it. This is exactly why a stock&apos;s price moves
            constantly: it&apos;s the price at which the most recent match happened.
          </p>
        </ConceptReveal>
      </LearningSection>

      <LearningSection eyebrow="Put together" question="">
        <div className="rounded-md border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/[0.06] p-5">
          <div className="flex items-start gap-3">
            <Handshake size={22} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" />
            <p className="text-[15px] leading-relaxed text-[var(--qf-ink)]">
              Your broker routes your order to an exchange, where it&apos;s matched with another
              investor&apos;s opposite order - not with the company. The exchange is the marketplace;
              the broker is your entry point into it; the other investor is who you&apos;re actually
              trading with.
            </p>
          </div>
        </div>
      </LearningSection>

      <LearningSection tight>
        <NextCuriosity
          prompt="Where does my money actually sit while all this happens?"
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
