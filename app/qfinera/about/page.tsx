import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Eye, FlaskConical, Layers, MessagesSquare } from "lucide-react";
import QFineraPage from "@/components/qfinance/QFineraPage";

export const metadata: Metadata = {
  title: "About",
  description: "What QFinera is, why it exists, and what you can do with it today.",
  alternates: { canonical: "/qfinera/about" },
};

const AREAS = [
  { icon: BookOpen, title: "Learn", body: "An eight-chapter beginner journey and a Pool Guide, in plain language.", href: "/qfinera/learn" },
  { icon: FlaskConical, title: "Research", body: "A simple way to think through a company, an industry or the economy.", href: "/qfinera/research" },
  { icon: Eye, title: "Global Watch", body: "Members share useful findings, with sources, for everyone to read.", href: "/qfinera/watch" },
  { icon: MessagesSquare, title: "Community", body: "Ask questions and discuss them with other investors.", href: "/qfinera/community" },
  { icon: Layers, title: "Pools", body: "Shared accounting for a group that invests together: units, NAV, trades, approvals and audit.", href: "/qfinera/pools" },
];

const PRINCIPLES = [
  ["Understanding before action", "We explain how things work. We never tell anyone what to buy or sell."],
  ["Your money stays yours", "QFinera does not hold funds, place orders or manage anyone's money. Pools record what a group does at its own bank and broker."],
  ["Records you can trust", "Pool accounting is precise and append-only. Corrections are new entries, and every change shows who made it and why."],
  ["Honest about data", "There is no live market feed. Prices are recorded with their date, and a missing price is shown as missing."],
  ["Plain language", "If a term needs explaining, we explain it."],
];

export default function AboutPage() {
  return (
    <QFineraPage
      width="narrow"
      eyebrow="About"
      title="QFinera helps people understand what they invest in."
      description="It is a place to learn the basics, research companies, share useful findings, and keep honest records of money invested together."
    >
      <section aria-labelledby="why-h">
        <h2 id="why-h" className="font-display text-[22px] font-semibold text-[var(--qf-ink)]">
          Why it exists
        </h2>
        <div className="mt-3 space-y-3 text-[15.5px] leading-relaxed text-[var(--qf-ink)]">
          <p>More Indians are investing than ever, often on a tip, a reel or a friend&apos;s advice. Good explanations are scattered and full of jargon.</p>
          <p>
            And many people already invest together, with family or friends, keeping track in a spreadsheet or a group chat. That works until someone asks
            who owns how much.
          </p>
          <p>QFinera brings learning, research, discussion and fair group record-keeping into one calm product.</p>
        </div>
      </section>

      <section aria-labelledby="what-h" className="mt-12">
        <h2 id="what-h" className="font-display text-[22px] font-semibold text-[var(--qf-ink)]">
          What you can do today
        </h2>
        <ul className="mt-4 space-y-2.5">
          {AREAS.map((a) => (
            <li key={a.title}>
              <Link href={a.href} className="group flex items-start gap-3 rounded-xl border border-[var(--qf-line)] p-4 transition-colors hover:border-[var(--qf-brass)]">
                <a.icon size={20} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[17px] font-semibold text-[var(--qf-ink)]">{a.title}</span>
                  <span className="mt-0.5 block text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">{a.body}</span>
                </span>
                <ArrowRight size={15} className="mt-1 shrink-0 text-[var(--qf-ink-soft)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-h" className="mt-12">
        <h2 id="how-h" className="font-display text-[22px] font-semibold text-[var(--qf-ink)]">
          How we build it
        </h2>
        <dl className="mt-4 divide-y divide-[var(--qf-line)] border-y border-[var(--qf-line)]">
          {PRINCIPLES.map(([t, b]) => (
            <div key={t} className="grid gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <dt className="font-display text-[16px] font-semibold text-[var(--qf-ink)]">{t}</dt>
              <dd className="text-[14.5px] leading-relaxed text-[var(--qf-ink-soft)]">{b}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="scope-h" className="mt-12 rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-1)]/60 p-5 sm:p-6">
        <h2 id="scope-h" className="font-display text-[18px] font-semibold text-[var(--qf-ink)]">
          Current scope
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14.5px] leading-relaxed text-[var(--qf-ink)]">
          <li>Educational and record-keeping software. Not investment, tax or legal advice.</li>
          <li>Pools are invite-only, for people who know each other. QFinera does not offer pools to the public or take custody of money.</li>
          <li>No live prices, broker connections or automated trading.</li>
        </ul>
        <p className="mt-4 text-[14px] text-[var(--qf-ink-soft)]">
          Curious what comes later?{" "}
          <Link href="/qfinera/roadmap" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
            See what&apos;s next
          </Link>
        </p>
      </section>

      <p className="mt-12 text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">
        QFinera is built in India by{" "}
        <Link href="/" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
          QCyberIndia
        </Link>
        . Questions or feedback? Ask in{" "}
        <Link href="/qfinera/community" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
          Community
        </Link>
        .
      </p>
    </QFineraPage>
  );
}
