import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, TrendingUp, Smartphone, Users, Brain, Landmark, HelpCircle } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import CampaignSection from "@/components/qfinance/campaign/CampaignSection";
import ConceptReveal from "@/components/qfinance/learning/ConceptReveal";
import Reveal from "@/components/Reveal";
import ScrollToJourney from "@/components/qfinance/learning/ScrollToJourney";

export const metadata: Metadata = {
  title: "Why Is India Investing? | QFinance",
  description:
    "Something changed in how Indians think about the stock market. A short, honestly-sourced look at why — and what it means before you invest.",
  alternates: { canonical: "/qfinance/why-india-investing" },
  openGraph: {
    title: "Why Is India Investing? | QFinance",
    description:
      "Something changed in how Indians think about the stock market. A short, honestly-sourced look at why.",
    url: "/qfinance/why-india-investing",
    type: "article",
  },
};

/** Plain CSS bar comparison — no SVG, no animation library. Values are
 * illustrative proportions of the same verified account-growth figures
 * cited in the text and in `lib/qfinance-campaign-sources.ts`. */
function GrowthBars() {
  const points = [
    { label: "Dec 2016", value: 2.71, display: "2.71 cr" },
    { label: "Dec 2022", value: 11, display: "~11 cr" },
    { label: "Aug 2024", value: 17.1, display: "17.1 cr" },
    { label: "Jun 2026", value: 23.15, display: "23.15 cr" },
  ];
  const max = Math.max(...points.map((p) => p.value));

  return (
    <div className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--qf-ink-soft)]">
        Combined NSDL + CDSL demat accounts
      </p>
      <div className="mt-5 space-y-3.5">
        {points.map((p) => (
          <div key={p.label}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-[var(--qf-ink-soft)]">{p.label}</span>
              <span className="font-semibold text-[var(--qf-ink)]">{p.display}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[var(--qf-cream-2)]">
              <div
                className="h-2 rounded-full bg-[var(--qf-brass)]"
                style={{ width: `${(p.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11.5px] leading-relaxed text-[var(--qf-ink-soft)]">
        Total accounts, not unique people — one investor can hold accounts with several brokers.
        Source: NSDL/CDSL data as reported by financial media; see sources at the end of this page.
      </p>
    </div>
  );
}

function OldVsNew() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--qf-ink-soft)]">Earlier</p>
        <ul className="mt-2 space-y-1.5 text-[13.5px] text-[var(--qf-ink)]">
          <li>Bank branch</li>
          <li>Paperwork</li>
          <li>Call a broker</li>
          <li>Wait days</li>
        </ul>
      </div>
      <div className="rounded-md border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/[0.06] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--qf-brass-dark)]">Now</p>
        <ul className="mt-2 space-y-1.5 text-[13.5px] text-[var(--qf-ink)]">
          <li>Phone in hand</li>
          <li>App download</li>
          <li>Account in minutes</li>
          <li>Order in seconds</li>
        </ul>
      </div>
    </div>
  );
}

function EmotionalCycle() {
  return (
    <div className="rounded-2xl border border-[var(--qf-line)] bg-[var(--qf-surface)] p-5 sm:p-6">
      <div className="flex items-center justify-between border-b border-[var(--qf-line)] pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--qf-ink-soft)]">
            The emotional loop
          </p>
          <p className="mt-1 text-[12px] text-[var(--qf-ink-soft)]">
            How a price move can become an emotional decision
          </p>
        </div>

        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--qf-line)] text-sm text-[var(--qf-brass-dark)]"
        >
          ↻
        </span>
      </div>

      <div className="mt-6 space-y-5">
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-ink-soft)]">
              Market
            </p>
            <p className="mt-1 font-serif text-[18px] font-semibold text-[var(--qf-ink)]">
              Price rises
            </p>
          </div>

          <span aria-hidden="true" className="text-[var(--qf-brass-dark)]">
            →
          </span>

          <div className="text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-ink-soft)]">
              Feeling
            </p>
            <p className="mt-1 font-serif text-[18px] font-semibold text-[var(--qf-ink)]">
              Excitement
            </p>
          </div>

          <span aria-hidden="true" className="text-[var(--qf-brass-dark)]">
            →
          </span>

          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-ink-soft)]">
              Feeling
            </p>
            <p className="mt-1 font-serif text-[18px] font-semibold text-[var(--qf-ink)]">
              FOMO
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--qf-line)]" />
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--qf-ink-soft)]">
            Leads to
          </span>
          <div className="h-px flex-1 bg-[var(--qf-line)]" />
        </div>

        <div className="flex items-center justify-center gap-4">
          <div className="rounded-xl border border-[var(--qf-brass-dark)] bg-[var(--qf-cream-1)] px-6 py-3 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              Decision
            </p>
            <p className="mt-1 font-serif text-[20px] font-semibold text-[var(--qf-ink)]">
              Buy
            </p>
          </div>

          <span
            aria-hidden="true"
            className="text-lg text-[var(--qf-brass-dark)]"
          >
            ↓
          </span>

          <div className="rounded-xl border border-[var(--qf-line)] px-6 py-3 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-ink-soft)]">
              Later
            </p>
            <p className="mt-1 font-serif text-[20px] font-semibold text-[var(--qf-ink)]">
              Price falls
            </p>
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-ink-soft)]">
              Feeling
            </p>
            <p className="mt-1 font-serif text-[18px] font-semibold text-[var(--qf-ink)]">
              Panic
            </p>
          </div>

          <span aria-hidden="true" className="text-[var(--qf-brass-dark)]">
            →
          </span>

          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-ink-soft)]">
              Decision
            </p>
            <p className="mt-1 font-serif text-[18px] font-semibold text-[var(--qf-brass-dark)]">
              Sell
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 border-t border-[var(--qf-line)] pt-4 text-center">
        <p className="text-[12px] leading-5 text-[var(--qf-ink-soft)]">
          The market moves. Our emotions often move with it.
        </p>
      </div>
    </div>
  );
}

function GamblerToOwner() {
  return (
    <div className="flex items-center justify-center gap-4 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-6 text-center sm:gap-8">
      <div>
        <p className="font-display text-lg font-semibold text-[var(--qf-ink-soft)] line-through decoration-2">
          Gambler
        </p>
        <p className="mt-1 text-[12px] text-[var(--qf-ink-soft)]">guessing the price</p>
      </div>
      <ArrowRight size={20} className="shrink-0 text-[var(--qf-brass)]" />
      <div>
        <p className="font-display text-lg font-semibold text-[var(--qf-brass-dark)]">Owner</p>
        <p className="mt-1 text-[12px] text-[var(--qf-ink-soft)]">understanding what you hold</p>
      </div>
    </div>
  );
}

const checklistQuestions = [
  "Do you know who you're actually buying from?",
  "Do you know where your money goes after you place an order?",
  "Do you know what a Demat account actually stores?",
  "Do you know what happens to your holding when a share price falls?",
  "Do you know what fees you're paying, and on what?",
  "Do you know how selling actually works?",
];

export default function WhyIndiaInvestingPage() {
  return (
    <div>
      <QFinanceHeader />

      {/* Moment 1 — The old belief */}
      <section className="px-6 py-20 pb-12 sm:py-28 sm:pb-16">
        <div className="mx-auto max-w-xl text-center">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">
              Why is India investing?
            </p>
            <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-4xl">
              For a long time, the stock market felt like gambling.
            </h1>
            <p className="mt-5 text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              Gold. Fixed deposits. Property. For generations, these felt safe, familiar, tangible.
              The stock market felt like something else — unpredictable, opaque, closer to speculation
              than saving.
            </p>
            <p className="mt-4 font-display text-lg font-medium text-[var(--qf-ink)]">
              But something changed.
            </p>
          </Reveal>
        </div>

        <ScrollToJourney targetId="campaign-start" label="Continue the story" />
      </section>

      {/* Moment 2 — The shift */}
      <div id="campaign-start" className="scroll-mt-6">
        <CampaignSection
          moment="01"
          eyebrow="The shift"
          headline="A new generation started looking at investing differently."
          visual={
            <Smartphone
              size={36}
              strokeWidth={1.3}
              className="text-[var(--qf-brass)]"
            />
          }
          tone="tinted"
        >
        <p>
          Younger investors grew up with smartphones already in hand. Mutual funds, ETFs, and SIPs
          stopped being things explained only by a bank relationship manager — they became things
          discussed on the same apps used for everything else.
        </p>
        <p className="text-[13.5px] italic text-[var(--qf-ink-soft)]">
          This is a real behavioral shift, not a claim that every young Indian invests — participation
          has grown substantially, but still represents a minority of India&apos;s population.
        </p>
      </CampaignSection>

      </div>

      {/* Moment 3 — Access became easier */}
      <CampaignSection moment="02" eyebrow="Access" headline="Opening an account used to take days. Now it takes minutes.">
        <OldVsNew />
        <p className="mt-2 font-medium text-[var(--qf-ink)]">
          Access became easier. That is not the same as investing becoming safer.
        </p>
        <GrowthBars />
      </CampaignSection>

      {/* Moment 4 — The social feed */}
      <CampaignSection
        moment="03"
        eyebrow="Visibility"
        headline="The stock market stopped being something only in the business pages."
        visual={<Users size={36} strokeWidth={1.3} className="text-[var(--qf-brass)]" />}
        tone="tinted"
      >
        <p>
          Finance content now shows up in the same feed as everything else — short videos, personal
          stories, screenshots of gains. It made the market visible in a way it never was before.
        </p>
        <p>
          <strong className="text-[var(--qf-ink)]">Visibility isn&apos;t the same as understanding.</strong>{" "}
          Seeing someone else&apos;s trade doesn&apos;t tell you their full position, their risk
          tolerance, or what happened after the screenshot was taken.
        </p>
      </CampaignSection>

      {/* Moment 5 — Bull market / recency bias */}
      <CampaignSection
        moment="04"
        eyebrow="Recent memory"
        headline={
          <>
            &ldquo;What happened recently feels like what will happen next.&rdquo;
          </>
        }
        visual={<TrendingUp size={36} strokeWidth={1.3} className="text-[var(--qf-brass)]" />}
      >
        <p>
          Over one recent five-year period, the Nifty 50 and Nifty 500 delivered annualised returns
          of roughly 11.3% and 13.7%.{" "}
          <span className="text-[13.5px] italic text-[var(--qf-ink-soft)]">
            (One historical window — not a forecast, and not typical of every period.)
          </span>
        </p>
        <p>
          Strong recent performance can quietly reshape expectations. Psychologists call this{" "}
          <strong className="text-[var(--qf-ink)]">recency bias</strong> — the tendency to expect the
          recent past to repeat, even when markets don&apos;t work that way.
        </p>
      </CampaignSection>

      {/* Moment 6 — Emotional trap */}
      <CampaignSection moment="05" eyebrow="The emotional trap" headline="Growth in participation doesn't mean growth in good decisions." tone="tinted">
        <EmotionalCycle />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4">
            <p className="font-display text-sm font-semibold text-[var(--qf-ink)]">FOMO</p>
            <p className="mt-1 text-[13px] text-[var(--qf-ink-soft)]">&ldquo;Everyone else is making money.&rdquo;</p>
          </div>
          <div className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4">
            <p className="font-display text-sm font-semibold text-[var(--qf-ink)]">Loss aversion</p>
            <p className="mt-1 text-[13px] text-[var(--qf-ink-soft)]">Losing feels worse than gaining feels good.</p>
          </div>
          <div className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4">
            <p className="font-display text-sm font-semibold text-[var(--qf-ink)]">Herd behavior</p>
            <p className="mt-1 text-[13px] text-[var(--qf-ink-soft)]">&ldquo;If everyone is buying, it must be right.&rdquo;</p>
          </div>
          <div className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4">
            <p className="font-display text-sm font-semibold text-[var(--qf-ink)]">Recency bias</p>
            <p className="mt-1 text-[13px] text-[var(--qf-ink-soft)]">&ldquo;It went up recently, so it will keep going up.&rdquo;</p>
          </div>
        </div>
        <p className="mt-2 text-[13px] text-[var(--qf-ink-soft)]">
          India&apos;s regulator, SEBI, has repeatedly pointed out that most individual traders in
          futures &amp; options specifically lose money — a reminder that easier access hasn&apos;t
          made every outcome better.
        </p>
      </CampaignSection>

      {/* Moment 7 — Gambler to Owner (conceptual center) */}
      <CampaignSection
        moment="06"
        eyebrow="The real shift"
        headline="Buying a share is not the same as placing a bet."
        visual={<Landmark size={36} strokeWidth={1.3} className="text-[var(--qf-brass)]" />}
      >
        <GamblerToOwner />
        <p className="mt-2">
          A share represents an ownership interest in a company — subject to the rights and structure
          of that particular security — not a wager on which way a number moves next.
        </p>
        <p>
          The goal isn&apos;t to guess tomorrow&apos;s price. It&apos;s to understand what you actually
          own, and why.
        </p>
      </CampaignSection>

      {/* Moment 8 — The uncomfortable question */}
      <CampaignSection moment="07" eyebrow="A honest question" headline="If investing got easier, did we get better at it?" tone="tinted">
        <ul className="space-y-2.5">
          {checklistQuestions.map((q) => (
            <li key={q} className="flex items-start gap-2.5 text-[14.5px] text-[var(--qf-ink)]">
              <HelpCircle size={16} className="mt-0.5 shrink-0 text-[var(--qf-brass)]" />
              {q}
            </li>
          ))}
        </ul>
      </CampaignSection>

      {/* Moment 9 — The invitation */}
      <section className="px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-xl text-center">
          <Reveal>
            <Brain size={32} strokeWidth={1.3} className="mx-auto text-[var(--qf-brass)]" />
            <h2 className="mt-5 font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-3xl">
              You don&apos;t need to become a market expert before you start.
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              First, understand what actually happens when you invest — before you put in a rupee.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/qfinance/learn/beginner"
                className="inline-flex items-center gap-2 rounded-md bg-[var(--qf-brass-dark)] px-6 py-3 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90"
              >
                Start the Beginner Journey
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/qfinance/community"
                className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline"
              >
                Join the QFinance Community
              </Link>
            </div>
          </Reveal>

          {/* Sources — kept out of the narrative flow, disclosed rather than hidden */}
          <div className="mt-16 text-left">
            <ConceptReveal prompt="Where do these numbers come from?">
              <ul className="space-y-3">
                <li>
                  Combined demat accounts (~23.15 crore, June 2026) and NSE unique registered
                  investors (~13.1 crore, May 2026) are reported separately on purpose — one person
                  can hold several accounts, so account totals overstate the number of actual
                  investors.
                </li>
                <li>
                  SIP account growth, household equity ownership share, and 5-year index returns are
                  all NSE-published figures reported by financial media between February and July
                  2026.
                </li>
                <li>
                  These are fast-moving monthly figures, current as of this page&apos;s last research
                  pass (8 September 2026) — not fixed facts. Sources are maintained and reviewed
                  as part of QFinance&apos;s ongoing research process.
                </li>
              </ul>
            </ConceptReveal>
          </div>
        </div>
      </section>

      <QFinanceFooter />
    </div>
  );
}
