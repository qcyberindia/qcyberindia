import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Landmark, NotebookPen, FlaskConical, Users, UserCircle, Award, MessageCircle } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import Reveal from "@/components/Reveal";
import { qfinanceConfig } from "@/lib/qfinance-config";

export const metadata: Metadata = {
  title: "About",
  description: qfinanceConfig.description,
  alternates: { canonical: "/qfinera/about" },
};

// Community → Portfolio → Research/Thesis → Profile → Contribution — the
// flow named explicitly in the brief. Only Community is live; everything
// else is visibly quieter and marked "Coming with beta".
const flow = [
  { icon: Users, label: "Community", live: true },
  { icon: Landmark, label: "Portfolio", live: false },
  { icon: FlaskConical, label: "Research / Thesis", live: false },
  { icon: UserCircle, label: "Profile", live: false },
  { icon: Award, label: "Contribution", live: false },
];

const building = [
  { icon: Landmark, label: "Portfolio", description: "Connect your holdings — starting with Zerodha — and see them in one place." },
  { icon: NotebookPen, label: "Journal", description: "Record an investment decision, your reasoning, and what you believed at the time." },
  { icon: FlaskConical, label: "Research / Thesis", description: "Turn scattered notes into an actual thesis — save drafts, publish when ready." },
];

const notThis = [
  {
    label: "Not a trading platform",
    body: `${qfinanceConfig.name} doesn't place orders, execute trades, or connect to a broker to move money — Portfolio, when it ships, reads your holdings; it doesn't act on them.`,
  },
  {
    label: "Not signals or copy-trading",
    body: "Nobody here tells you what to buy or sell, and no feature lets you copy another member's trades. Community discussion is for learning and clarification, not personalized financial advice.",
  },
  {
    label: "Not a returns promise",
    body: "Nothing on this site or in the product implies a guaranteed or expected return. What you do with your own money is your decision, based on your own research and circumstances.",
  },
];

export default function AboutPage() {
  return (
    <div>
      <QFinanceHeader />

      {/* Hero */}
      <section className="border-b border-[var(--qf-line)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-xl text-center">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              About {qfinanceConfig.name}
            </p>
            <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-4xl">
              A New. <em className="font-light italic text-[var(--qf-brass-dark)]">Financial.</em> Era.
            </h1>
            <p className="mt-5 text-[16px] leading-relaxed text-[var(--qf-ink-soft)]">
              {qfinanceConfig.description}
            </p>
          </Reveal>
        </div>
      </section>

      {/* Why QFinera exists — a visually prominent two-column editorial
          block (eyebrow + short claim on the left, the reasoning on the
          right) rather than one long centered column. */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-[minmax(0,220px)_1fr] sm:gap-12">
          <Reveal>
            <div className="sm:sticky sm:top-24">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
                Why {qfinanceConfig.name} exists
              </p>
              <p className="mt-3 font-display text-xl font-semibold leading-snug text-[var(--qf-ink)]">
                Investing content is built to be consumed once. Investment thinking isn&apos;t.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="space-y-5 border-l-2 border-[var(--qf-brass)]/30 pl-6 text-[15.5px] leading-relaxed text-[var(--qf-ink)] sm:pl-8">
              <p>
                Most investing content is a video, a tip, a hot take — consumed once and forgotten.
                {" "}{qfinanceConfig.name} is built around something slower: the thinking an investor
                actually does over time. What you decided. Why you decided it. What you believed then,
                and what changed since.
              </p>
              <p>
                That means bringing research, reflection, and discussion into one connected place —
                instead of scattering your thinking across screenshots, group chats, and a notes app
                you never reopen.
              </p>
              <p>
                {qfinanceConfig.name} is built around independent thinking, not signals. Research over
                recommendations. Reflection over reaction. Discussion that sharpens a thesis, not one
                that just tells you what to buy.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How QFinera works — the full connected flow, compact, Community
          visibly the live anchor. */}
      <section className="border-t border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-6 py-14 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              How {qfinanceConfig.name} works
            </p>
          </Reveal>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-1 gap-y-4">
            {flow.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center gap-1">
                  <Reveal delay={i * 60}>
                    <div
                      className={`flex items-center gap-2 rounded-full border px-3.5 py-2 ${
                        step.live
                          ? "border-[var(--qf-brass)] bg-[var(--qf-cream-0)]"
                          : "border-[var(--qf-line)] bg-[var(--qf-cream-0)]/60"
                      }`}
                    >
                      <Icon size={15} className={step.live ? "text-[var(--qf-brass)]" : "text-[var(--qf-ink-soft)]"} />
                      <span className={`text-[13.5px] font-semibold ${step.live ? "text-[var(--qf-ink)]" : "text-[var(--qf-ink-soft)]"}`}>
                        {step.label}
                      </span>
                      {step.live && <span className="h-1.5 w-1.5 rounded-full bg-[var(--qf-brass)]" aria-hidden />}
                    </div>
                  </Reveal>
                  {i < flow.length - 1 && (
                    <ArrowRight size={14} className="text-[var(--qf-line)]" aria-hidden />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mx-auto mt-5 max-w-sm text-center text-[13px] text-[var(--qf-ink-soft)]">
            Community is live today. Everything after it is coming with beta.
          </p>
        </div>
      </section>

      {/* Community today — a highlighted callout, not another plain
          paragraph block, with a real CTA into the live product. */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl rounded-md border border-[var(--qf-brass)] bg-[var(--qf-cream-1)] p-7 sm:p-9">
          <Reveal>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-[var(--qf-brass)] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--qf-brass)]" />
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--qf-brass-dark)]">
                Live today
              </p>
            </div>
            <h2 className="mt-2.5 font-display text-2xl font-semibold tracking-tight text-[var(--qf-ink)]">
              Community
            </h2>
            <div className="mt-4 space-y-3.5 text-[15px] leading-relaxed text-[var(--qf-ink)]">
              <p>
                Anyone can ask a question — what a term means, why something moved, what a filing
                actually said. Other members reply with what they know or a different way to look at
                it. A thread is a small, asynchronous discussion — not a live chat, not a comments
                section.
              </p>
              <p>
                Every account is verified before it can post, so you&apos;re talking to real people —
                but what you show publicly is a display name you choose, not your legal identity or
                your email address. You can edit or delete your own posts and replies at any time.
                Moderation is enforced: no guaranteed-return claims, no pump-and-dump behavior, no
                personalized buy/sell instructions presented as certainty, no spam or impersonation.
              </p>
            </div>
            <Link
              href="/qfinera/community"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--qf-brass)] px-5 py-2.5 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90"
            >
              <MessageCircle size={15} />
              Explore Community
              <ArrowRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* What we're building */}
      <section className="border-t border-[var(--qf-line)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              What we&apos;re building
            </p>
            <p className="mx-auto mt-2 max-w-sm text-center text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">
              The rest of the workspace, coming with beta.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {building.map((item, i) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.label} delay={i * 70}>
                  <div className="relative flex h-full flex-col rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5">
                    <span className="absolute right-3 top-3 rounded-full border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
                      Coming with beta
                    </span>
                    <Icon size={20} className="text-[var(--qf-brass)]" />
                    <p className="mt-3 font-display text-[15px] font-semibold text-[var(--qf-ink)]">{item.label}</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--qf-ink-soft)]">{item.description}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* What QFinera is not */}
      <section className="border-t border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              What {qfinanceConfig.name} is not
            </p>
          </Reveal>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {notThis.map((item, i) => (
              <Reveal key={item.label} delay={i * 70}>
                <div className="h-full rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-5">
                  <p className="font-display text-[14.5px] font-semibold text-[var(--qf-ink)]">{item.label}</p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--qf-ink-soft)]">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[var(--qf-line)] px-6 py-16 text-center sm:py-20">
        <Reveal>
          <p className="font-display text-xl font-semibold text-[var(--qf-ink)]">
            Your investment thinking deserves a place of its own.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/qfinera/beta"
              className="inline-flex items-center gap-2 rounded-sm bg-[var(--qf-brass)] px-6 py-3 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90"
            >
              Join QFinera
              <ArrowRight size={15} />
            </Link>
            <Link href="/qfinera/community" className="font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline">
              Explore Community →
            </Link>
          </div>
        </Reveal>
      </section>

      <QFinanceFooter />
    </div>
  );
}
