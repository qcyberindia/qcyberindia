import Link from "next/link";
import {
  ArrowRight,
  Compass,
  TrendingUp,
  MessagesSquare,
  Landmark,
  NotebookPen,
  FlaskConical,
  Users,
  UserCircle,
  Award,
} from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import Reveal from "@/components/Reveal";
import { qfinanceConfig } from "@/lib/qfinance-config";

// The connected product loop QFinera is being built around. Only
// "Community" links to something that actually exists today — the rest
// are the future SaaS this website explains, not functionality this
// repository implements. See qfinance.md's QFinera pivot entries: this
// repo is the marketing site, not the SaaS backend.
const loop = [
  { icon: Landmark, label: "Portfolio", description: "Connect your holdings and see them in one place." },
  { icon: NotebookPen, label: "Journal", description: "Record what you decided, and why, as you decide it." },
  { icon: FlaskConical, label: "Research", description: "Build a thesis before you build conviction." },
  { icon: Users, label: "Community", description: "Discuss your thinking with other investors.", live: true },
  { icon: UserCircle, label: "Profile", description: "Your research and contributions, in one place." },
  { icon: Award, label: "Contribution", description: "Meaningful contribution can lower next month's cost." },
];

const availableNow = [
  {
    icon: Compass,
    title: "I'm completely new",
    description: "Start with one question at a time. No charts, no jargon, no stock tips.",
    cta: "Start the Beginner Journey",
    href: "/qfinance/learn/beginner",
  },
  {
    icon: TrendingUp,
    title: "I'm curious about India's investing boom",
    description: "Why did investing suddenly become normal? A short interactive story.",
    cta: "Why Is India Investing?",
    href: "/qfinance/why-india-investing",
  },
  {
    icon: MessagesSquare,
    title: "I have a question",
    description: "Read what other beginners asked — and what they learned.",
    cta: "Explore Community",
    href: "/qfinance/community",
  },
];

export default function QFinancePage() {
  return (
    <div>
      <QFinanceHeader />

      {/* Hero — brand / tagline / positioning */}
      <section className="border-b border-[var(--qf-line)] px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--qf-brass-dark)]">
              <span className="h-px w-7 bg-[var(--qf-brass)]" />
              {qfinanceConfig.name}
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--qf-ink)] sm:text-5xl">
              A New. <em className="font-light italic text-[var(--qf-brass-dark)]">Financial.</em> Era.
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-[var(--qf-ink-soft)]">
              {qfinanceConfig.description}
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/qfinance/beta"
                className="inline-flex items-center gap-2 rounded-sm bg-[var(--qf-brass)] px-6 py-3 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90"
              >
                Join the Beta
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/qfinance/community"
                className="font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline"
              >
                Explore Community →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* The product loop — honestly marked: only Community is live today */}
      <section className="border-b border-[var(--qf-line)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              What {qfinanceConfig.name} brings together
            </p>
            <p className="mx-auto mt-3 max-w-md text-center text-[15px] leading-relaxed text-[var(--qf-ink-soft)]">
              Portfolio → Journal → Research → Community → Profile → Contribution — one connected
              workspace for your own investment thinking.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {loop.map((item, i) => {
              const Icon = item.icon;
              return (
                <Reveal key={item.label} delay={i * 70}>
                  <div className="relative flex h-full flex-col rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5">
                    {!item.live && (
                      <span className="absolute right-3 top-3 rounded-full border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
                        Coming soon
                      </span>
                    )}
                    <Icon size={20} className="text-[var(--qf-brass)]" />
                    <p className="mt-3 font-display text-[15px] font-semibold text-[var(--qf-ink)]">{item.label}</p>
                    <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-[var(--qf-ink-soft)]">
                      {item.description}
                    </p>
                    {item.live && (
                      <Link
                        href="/qfinance/community"
                        className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--qf-brass-dark)] hover:underline"
                      >
                        Explore now
                        <ArrowRight size={12} />
                      </Link>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Available now — the existing educational content, honestly framed
          as supporting content rather than the product's primary definition */}
      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              Available now
            </p>
            <p className="mx-auto mt-3 max-w-md text-center text-[15px] leading-relaxed text-[var(--qf-ink-soft)]">
              While the full workspace is being built, start with the free learning path and community.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {availableNow.map((p, i) => {
              const Icon = p.icon;
              return (
                <Reveal key={p.title} delay={i * 90}>
                  <Link
                    href={p.href}
                    className="group flex h-full flex-col rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-6 transition-colors hover:border-[var(--qf-brass)]"
                  >
                    <Icon size={20} className="text-[var(--qf-brass)]" />
                    <h2 className="mt-4 font-display text-lg font-semibold text-[var(--qf-ink)]">{p.title}</h2>
                    <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">
                      {p.description}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)]">
                      {p.cta}
                      <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <QFinanceFooter />
    </div>
  );
}
