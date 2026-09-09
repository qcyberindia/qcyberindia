import Link from "next/link";
import { ArrowRight, Compass, TrendingUp, MessagesSquare } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import Reveal from "@/components/Reveal";

const paths = [
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

      <section className="border-b border-[var(--qf-line)] px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--qf-brass-dark)]">
              <span className="h-px w-7 bg-[var(--qf-brass)]" />
              QFinance
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--qf-ink)] sm:text-5xl">
              Understand first. <em className="font-light italic text-[var(--qf-brass-dark)]">Invest second.</em>
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-[var(--qf-ink-soft)]">
              Learn how investing actually works — without starting with charts, jargon, or stock tips.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-5 sm:grid-cols-3">
            {paths.map((p, i) => {
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
          <Reveal delay={280}>
            <p className="mt-8 text-center text-[13px] font-medium text-[var(--qf-ink-soft)]">
              
            </p>
          </Reveal>
        </div>
      </section>

      <QFinanceFooter />
    </div>
  );
}
