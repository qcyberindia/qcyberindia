import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Eye, Globe2, MessagesSquare, NotebookPen } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import { readDb } from "@/lib/fund/db";
import { listMyPools, type PoolSummary } from "@/lib/fund/services/pools";
import { getQFinanceServerSession } from "@/lib/qfinance-community-auth";

export const metadata: Metadata = {
  title: "Research",
  description: "A simple research workflow: learn the concept, understand the context, discuss it, and keep shared notes with your group.",
  alternates: { canonical: "/qfinera/research" },
};

export const dynamic = "force-dynamic";

const STEPS = [
  {
    icon: BookOpen,
    title: "Understand the concept",
    body: "Start with the idea itself: what a share, an index or a cost really is. Short Learn chapters, one question each.",
    href: "/qfinera/learn",
    cta: "Open Learn",
  },
  {
    icon: Globe2,
    title: "Read the context",
    body: "Why more Indians are investing now, and what that does and doesn't mean for you.",
    href: "/qfinera/why-india-investing",
    cta: "Why India is investing",
  },
  {
    icon: MessagesSquare,
    title: "Test it in discussion",
    body: "Ask what you're unsure about. Explaining and questioning an idea in public is the fastest way to find its weak spots.",
    href: "/qfinera/community",
    cta: "Ask the Community",
  },
  {
    icon: Eye,
    title: "Share what you find",
    body: "Post an announcement, an article or a risk to Global Watch with its source, so every QFinera member can read it.",
    href: "/qfinera/watch",
    cta: "Open Global Watch",
  },
  {
    icon: NotebookPen,
    title: "Keep shared notes with your group",
    body: "Inside a pool, the Watchlist holds the group's research notes, links and discussion for each instrument. Notes, not tips.",
    href: "/qfinera/pools",
    cta: "Go to Pools",
  },
];

export default async function ResearchPage() {
  const session = await getQFinanceServerSession().catch(() => null);
  let pools: PoolSummary[] = [];
  if (session) {
    try {
      pools = (await listMyPools(readDb(), session.userId)).filter((p) => p.membershipStatus === "active");
    } catch {
      pools = [];
    }
  }

  return (
    <div>
      <QFinanceHeader />
      <main id="main" className="px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">Research</p>
          <h1 className="mt-2 font-display text-[32px] font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[42px]">
            Think it through before you act on it.
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--qf-ink-soft)]">
            A simple workflow using what QFinera already has. It helps you reason; it never tells you what to buy or sell.
          </p>

          <ol className="mt-10 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-4 rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-5 sm:flex-row sm:items-center sm:p-6">
                <div className="flex shrink-0 items-center gap-3 sm:w-14 sm:flex-col sm:gap-1">
                  <span className="font-display text-[13px] font-semibold tabular-nums text-[var(--qf-brass-dark)]">{String(i + 1).padStart(2, "0")}</span>
                  <s.icon size={20} className="text-[var(--qf-brass-dark)]" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-[19px] font-semibold text-[var(--qf-ink)]">{s.title}</h2>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--qf-ink-soft)]">{s.body}</p>
                </div>
                <Link
                  href={s.href}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[var(--qf-line)] px-4 text-[14px] font-semibold text-[var(--qf-ink)] hover:border-[var(--qf-brass)]"
                >
                  {s.cta} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>

          {pools.length > 0 && (
            <section aria-labelledby="my-research" className="mt-12">
              <h2 id="my-research" className="font-display text-[22px] font-semibold text-[var(--qf-ink)]">Your groups&rsquo; research notes</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {pools.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/qfinera/pools/${p.id}/watchlist`}
                      className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-4 py-3 hover:border-[var(--qf-brass)]"
                    >
                      <span className="min-w-0 truncate font-medium text-[var(--qf-ink)]">{p.name} &middot; Watchlist</span>
                      <ArrowRight size={15} className="shrink-0 text-[var(--qf-brass-dark)]" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-12 grid gap-4 md:grid-cols-2">
            <Link href="/qfinera/watch/new" className="group flex items-start gap-3 rounded-xl border border-[var(--qf-brass)]/45 bg-[var(--qf-brass)]/[0.07] p-5 hover:border-[var(--qf-brass)]">
              <Eye size={20} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" aria-hidden="true" />
              <span>
                <span className="block font-display text-[17px] font-semibold text-[var(--qf-ink)]">Found something useful?</span>
                <span className="mt-1 block text-[14px] text-[var(--qf-ink-soft)]">Share it on Global Watch so other members can read the source and understand it.</span>
              </span>
            </Link>
            <Link href="/qfinera/roadmap" className="group flex items-start gap-3 rounded-xl border border-[var(--qf-line)] p-5 hover:border-[var(--qf-brass)]">
              <NotebookPen size={20} className="mt-0.5 shrink-0 text-[var(--qf-ink-soft)]" aria-hidden="true" />
              <span>
                <span className="block font-display text-[17px] font-semibold text-[var(--qf-ink)]">A personal research journal</span>
                <span className="mt-1 block text-[14px] text-[var(--qf-ink-soft)]">Under development. See what&rsquo;s next for QFinera.</span>
              </span>
            </Link>
          </section>
        </div>
      </main>
      <QFinanceFooter />
    </div>
  );
}
