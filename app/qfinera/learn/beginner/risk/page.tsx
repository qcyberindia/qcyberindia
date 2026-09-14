import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldAlert, Siren, Lock } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import LearningSection from "@/components/qfinance/learning/LearningSection";
import ConceptReveal from "@/components/qfinance/learning/ConceptReveal";
import NextCuriosity from "@/components/qfinance/learning/NextCuriosity";
import ProgressTracker from "@/components/qfinance/learning/ProgressTracker";
import Reveal from "@/components/Reveal";
import { getChapter, getAdjacentChapters } from "@/lib/qfinance-chapters";

const chapter = getChapter("risk")!;
const { prev, next } = getAdjacentChapters("risk");

export const metadata: Metadata = {
  title: chapter.title,
  description: chapter.description,
  alternates: { canonical: "/qfinera/learn/beginner/risk" },
};

function IconVisual({ Icon }: { Icon: typeof ShieldAlert }) {
  return (
    <div className="flex h-36 items-center justify-center rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)]">
      <Icon size={40} strokeWidth={1.4} className="text-[var(--qf-brass)]" />
    </div>
  );
}

export default function ChapterRiskPage() {
  return (
    <div>
      <ProgressTracker slug="risk" />
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
              Real markets are risky. Scams promise to remove that risk.
            </h1>
          </Reveal>
        </div>
      </section>

      <LearningSection eyebrow="The single biggest red flag" question="What's the one phrase that should worry you most?">
        <IconVisual Icon={Siren} />
        <p>
          <strong className="text-[var(--qf-ink)]">&ldquo;Guaranteed returns.&rdquo;</strong> No legitimate
          market investment can guarantee a return - markets go up and down, and anyone claiming otherwise
          is either misinformed or lying to you.
        </p>
        <ConceptReveal prompt="But what about fixed deposits — those guarantee a return, right?">
          <p>
            A bank FD is a different kind of product with a different structure and its own protections -
            it&apos;s not a market investment whose value moves with a company&apos;s or an index&apos;s
            performance. When something&apos;s value depends on the market, no one can guarantee what that
            market will do next.
          </p>
        </ConceptReveal>
      </LearningSection>

      <LearningSection eyebrow="Where scams live" question="What do these scams usually look like?">
        <IconVisual Icon={ShieldAlert} />
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Unsolicited stock tips over WhatsApp or Telegram promising quick, certain profit.</li>
          <li>Fake trading apps that look legitimate but aren&apos;t registered with SEBI.</li>
          <li>&ldquo;VIP groups&rdquo; asking for money upfront to unlock trading advice.</li>
          <li>Pressure to invest immediately, before you have time to check anything.</li>
          <li>Screenshots of gains from people you&apos;ve never verified.</li>
        </ul>
        <p>
          Scammers rely on urgency and social proof - the same psychological patterns discussed
          in{" "}
          <Link href="/qfinera/why-india-investing" className="font-medium text-[var(--qf-brass-dark)] hover:underline">
            why India is investing
          </Link>
          . A genuine opportunity doesn&apos;t disappear if you take a day to check it.
        </p>
      </LearningSection>

      <LearningSection eyebrow="How to check" question="How do I actually verify something is legitimate?">
        <IconVisual Icon={Lock} />
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Confirm your broker or advisor is registered with <strong className="text-[var(--qf-ink)]">SEBI</strong> - check on SEBI&apos;s own website, not a link someone sends you.</li>
          <li>Never share your OTP, password, or login credentials with anyone - not even someone claiming to be from your broker.</li>
          <li>Be skeptical of anyone who won&apos;t let you take time to think or verify independently.</li>
          <li>If it promises certainty in an uncertain market, that certainty is the scam.</li>
        </ul>
      </LearningSection>

      <LearningSection eyebrow="Put together" question="">
        <div className="rounded-md border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/[0.06] p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert size={22} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" />
            <p className="text-[15px] leading-relaxed text-[var(--qf-ink)]">
              Real investing carries real, unavoidable risk - that&apos;s not a flaw to fix, it&apos;s
              the nature of markets. Anyone promising to remove that risk with a guaranteed return isn&apos;t
              offering a better product. They&apos;re offering a scam.
            </p>
          </div>
        </div>
      </LearningSection>

      <LearningSection tight>
        <NextCuriosity
          prompt="Okay — so what should I actually buy?"
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
