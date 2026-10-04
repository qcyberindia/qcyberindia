import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Globe2, Layers, MessagesSquare } from "lucide-react";
import QFineraPage from "@/components/qfinance/QFineraPage";
import { chapters } from "@/lib/qfinance-chapters";

export const metadata: Metadata = {
  title: "Learn",
  description: "Understand investing in India without the textbook: short chapters, plain language, real examples.",
  alternates: { canonical: "/qfinera/learn" },
};

const totalMinutes = chapters.reduce((sum, c) => sum + c.estMinutes, 0);

const TRACKS = [
  {
    href: "/qfinera/learn/beginner",
    icon: BookOpen,
    title: "Beginner Journey",
    meta: `${chapters.length} chapters · about ${totalMinutes} minutes`,
    body: "What a share is, who you buy from, accounts, costs, scams, what to buy, and a safe practice order.",
    cta: "Start the journey",
  },
  {
    href: "/qfinera/learn/pool-guide",
    icon: Layers,
    title: "Pool Guide",
    meta: "One page",
    body: "How a group fund works: roles, contributions, units and NAV, trades, P&L, approvals and the audit trail.",
    cta: "Read the guide",
  },
  {
    href: "/qfinera/why-india-investing",
    icon: Globe2,
    title: "Why India is investing",
    meta: "Context",
    body: "Why more Indians are investing now, and what that means for someone starting out.",
    cta: "Read the story",
  },
];

export default function LearnPage() {
  return (
    <QFineraPage eyebrow="Learn" title="Understand investing, one question at a time" description="Short chapters in plain language. No jargon walls, no tips, no pressure.">
      <ul className="grid gap-4 md:grid-cols-3">
        {TRACKS.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              className="group flex h-full flex-col rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-5 transition-colors hover:border-[var(--qf-brass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)]"
            >
              <t.icon size={22} className="text-[var(--qf-brass-dark)]" aria-hidden="true" />
              <h2 className="mt-3 font-display text-[19px] font-semibold text-[var(--qf-ink)]">{t.title}</h2>
              <p className="mt-0.5 text-[12.5px] text-[var(--qf-ink-soft)]">{t.meta}</p>
              <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--qf-ink)]">{t.body}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 font-display text-[14px] font-semibold text-[var(--qf-brass-dark)]">
                {t.cta} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="chapters-h" className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="chapters-h" className="font-display text-[22px] font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[26px]">
            The Beginner Journey
          </h2>
          <Link href="/qfinera/learn/beginner" className="text-[14px] font-semibold text-[var(--qf-brass-dark)] hover:underline">
            See the journey map
          </Link>
        </div>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {chapters.map((c) => (
            <li key={c.id}>
              <Link
                href={`/qfinera/learn/beginner/${c.slug}`}
                className="group flex h-full flex-col rounded-xl border border-[var(--qf-line)] p-4 transition-colors hover:border-[var(--qf-brass)] hover:bg-[var(--qf-cream-1)]/50"
              >
                <span className="flex items-center justify-between text-[12px] text-[var(--qf-ink-soft)]">
                  <span className="font-display font-semibold tabular-nums text-[var(--qf-brass-dark)]">{c.number}</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} aria-hidden="true" /> {c.estMinutes} min
                  </span>
                </span>
                <span className="mt-2 font-display text-[16px] font-semibold leading-snug text-[var(--qf-ink)]">{c.title}</span>
                <span className="mt-1 text-[13px] leading-snug text-[var(--qf-ink-soft)]">{c.question}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 grid gap-4 md:grid-cols-2">
        <Link href="/qfinera/community" className="group flex items-start gap-3 rounded-xl border border-[var(--qf-line)] p-5 hover:border-[var(--qf-brass)]">
          <MessagesSquare size={20} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" aria-hidden="true" />
          <span>
            <span className="block font-display text-[17px] font-semibold text-[var(--qf-ink)]">Have a question?</span>
            <span className="mt-1 block text-[14px] text-[var(--qf-ink-soft)]">Ask in Community. Someone else is wondering the same thing.</span>
          </span>
        </Link>
        <Link href="/qfinera/research" className="group flex items-start gap-3 rounded-xl border border-[var(--qf-line)] p-5 hover:border-[var(--qf-brass)]">
          <BookOpen size={20} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" aria-hidden="true" />
          <span>
            <span className="block font-display text-[17px] font-semibold text-[var(--qf-ink)]">Ready to look at real companies?</span>
            <span className="mt-1 block text-[14px] text-[var(--qf-ink-soft)]">Research shows how to read a company, an industry and the economy.</span>
          </span>
        </Link>
      </section>
    </QFineraPage>
  );
}
