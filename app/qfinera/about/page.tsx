import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Landmark, NotebookPen, FlaskConical, Users, UserCircle, Award } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import Reveal from "@/components/Reveal";
import { qfinanceConfig } from "@/lib/qfinance-config";

export const metadata: Metadata = {
  title: "About",
  description: qfinanceConfig.description,
  alternates: { canonical: "/qfinera/about" },
};

const loop = [
  { icon: Landmark, label: "Portfolio", description: "Connect your holdings — starting with Zerodha — and see them in one place.", live: false },
  { icon: NotebookPen, label: "Journal", description: "Record an investment decision, your reasoning, and what you believed at the time.", live: false },
  { icon: FlaskConical, label: "Research / Thesis", description: "Turn scattered notes into an actual thesis — save drafts, publish when ready.", live: false },
  { icon: Users, label: "Community", description: "Discuss your thinking with other investors.", live: true },
  { icon: UserCircle, label: "Profile", description: "Your research, journal history, and contributions in one place.", live: false },
  { icon: Award, label: "Contribution", description: "Meaningful contribution to the community can become part of your reputation.", live: false },
];

export default function AboutPage() {
  return (
    <div>
      <QFinanceHeader />

      <section className="border-b border-[var(--qf-line)] px-6 py-20 sm:py-24">
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

      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-xl space-y-5 text-[15.5px] leading-relaxed text-[var(--qf-ink)]">
          <Reveal>
            <p>
              Most investing content is built to be consumed once and forgotten — a video, a tip, a hot
              take. {qfinanceConfig.name} is built around something slower: the thinking an investor
              actually does over time. What you decided. Why you decided it. What you believed then,
              and what changed since.
            </p>
            <p>
              That means bringing research, reflection, and discussion into one connected place —
              instead of scattering your thinking across screenshots, group chats, and a notes app you
              never reopen.
            </p>
            <p>
              {qfinanceConfig.name} is built around independent thinking, not signals. Research over
              recommendations. Reflection over reaction. Discussion that sharpens a thesis, not one
              that just tells you what to buy.
            </p>
            <p>
              You&apos;re a verified member — we know it&apos;s really you behind your account — but you
              don&apos;t need to use your real name to take part. What you choose to share publicly in
              Community is up to you; your email is never shown to anyone else.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-[var(--qf-line)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              What {qfinanceConfig.name} is not
            </p>
            <div className="mt-4 space-y-2.5 text-[15px] leading-relaxed text-[var(--qf-ink)]">
              <p>
                Not a trading platform. {qfinanceConfig.name} doesn&apos;t place orders, execute trades,
                or connect to a broker to move money — Portfolio, when it ships, reads your holdings; it
                doesn&apos;t act on them.
              </p>
              <p>
                Not a signals or copy-trading service. Nobody here tells you what to buy or sell, and no
                feature is built to let you copy another member&apos;s trades. Community discussion is
                for learning and clarification, not personalized financial advice.
              </p>
              <p>
                Not a returns promise. Nothing on this site or in the product implies a guaranteed or
                expected return. What you do with your own money is your decision, based on your own
                research and circumstances.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-[var(--qf-line)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-xl">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              How Community works
            </p>
            <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-[var(--qf-ink)]">
              <p>
                Anyone can ask a question — what a term means, why something moved, what a filing
                actually said. Other members reply with what they know, what they&apos;d research next,
                or a different way to look at it. A thread is a small, asynchronous discussion, not a
                live chat and not a comments section.
              </p>
              <p>
                Every account is verified before it can post, so you&apos;re talking to real people —
                but what you show publicly is a display name you choose, not your legal identity or
                your email address. Posts and replies stay visible to everyone; you can edit or delete
                your own at any time.
              </p>
              <p>
                Moderation exists and is enforced: no guaranteed-return claims, no pump-and-dump
                behavior, no personalized buy/sell instructions presented as certainty, no spam or
                impersonation.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t border-[var(--qf-line)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              The connected experience
            </p>
            <p className="mx-auto mt-3 max-w-md text-center text-[15px] leading-relaxed text-[var(--qf-ink-soft)]">
              Portfolio → Journal → Research / Thesis → Community → Profile → Contribution
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {loop.map((item, i) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.label} delay={i * 70}>
                  <div className="relative flex h-full flex-col rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5">
                    <span
                      className={`absolute right-3 top-3 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                        item.live
                          ? "border-[var(--qf-up)]/40 bg-[var(--qf-up)]/10 text-[var(--qf-up)]"
                          : "border-[var(--qf-line)] bg-[var(--qf-cream-0)] text-[var(--qf-ink-soft)]"
                      }`}
                    >
                      {item.live ? "Live today" : "Coming with beta"}
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

      <section className="border-t border-[var(--qf-line)] px-6 py-16 text-center sm:py-20">
        <Reveal>
          <p className="font-display text-xl font-semibold text-[var(--qf-ink)]">
            The Community and Beginner Journey are live today.
          </p>
          <p className="mx-auto mt-2 max-w-md text-[14.5px] leading-relaxed text-[var(--qf-ink-soft)]">
            The rest of the workspace — Portfolio, Journal, and Research — is what the beta builds toward.
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
