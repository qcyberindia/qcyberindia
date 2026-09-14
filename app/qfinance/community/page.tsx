import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircleQuestion } from "lucide-react";
import { listQFinanceCommunityPosts } from "@/lib/db";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import PostCard from "@/components/qfinance/community/PostCard";
import CategoryFilter from "@/components/qfinance/community/CategoryFilter";
import CommunityGuidelines from "@/components/qfinance/community/CommunityGuidelines";
import AskQuestionButton from "@/components/qfinance/community/AskQuestionButton";

export const metadata: Metadata = {
  title: "Community",
  description:
    "Ask before you invest. Confused about stocks, mutual funds, demat accounts, SIPs, risk, or fees? Ask a question and learn from other beginners.",
  alternates: { canonical: "/qfinance/community" },
};

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const { category, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const { posts, total, pageCount } = await listQFinanceCommunityPosts({ category, page });

  return (
    <div>
      <QFinanceHeader />

      <main className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
          Community
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[var(--qf-ink)] sm:text-4xl">
          Ask before you invest.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--qf-ink-soft)]">
          Confused about stocks, mutual funds, demat accounts, SIPs, risk, or fees? Ask a question,
          learn from other beginners, and keep the conversation useful.
        </p>

        <div className="mt-6">
          <AskQuestionButton />
        </div>

        <div className="mt-10">
          <CommunityGuidelines />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <CategoryFilter active={category} />
        </div>

        <div className="mt-6 space-y-3">
          {posts.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--qf-line)] p-10 text-center">
              <MessageCircleQuestion size={28} className="mx-auto text-[var(--qf-ink-soft)]" />
              <p className="mt-3 font-display text-lg font-semibold text-[var(--qf-ink)]">
                {category ? `No questions in ${category} yet.` : "Be the first to ask."}
              </p>
              <p className="mt-1.5 text-[14px] text-[var(--qf-ink-soft)]">
                Start with something you&apos;ve always wondered about investing.
              </p>
            </div>
          ) : (
            posts.map((post) => <PostCard key={post.id} post={post} />)
          )}
        </div>

        {pageCount > 1 && (
          <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Community pagination">
            {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/qfinance/community?${new URLSearchParams({
                  ...(category ? { category } : {}),
                  page: String(p),
                }).toString()}`}
                aria-current={p === page ? "page" : undefined}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-medium transition-colors ${
                  p === page
                    ? "bg-[var(--qf-brass)] text-[var(--qf-cream-0)]"
                    : "text-[var(--qf-ink-soft)] hover:bg-[var(--qf-cream-1)]"
                }`}
              >
                {p}
              </Link>
            ))}
          </nav>
        )}

        {total > 0 && (
          <p className="mt-4 text-center text-[12.5px] text-[var(--qf-ink-soft)]">
            {total} {total === 1 ? "question" : "questions"}
          </p>
        )}

        <div className="mt-16 grid gap-4 border-t border-[var(--qf-line)] pt-10 sm:grid-cols-2">
          <Link
            href="/qfinance/learn/beginner"
            className="group rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 transition-colors hover:border-[var(--qf-brass)]"
          >
            <p className="font-display text-[15px] font-semibold text-[var(--qf-ink)]">Not sure where to start?</p>
            <p className="mt-1 flex items-center gap-1 text-[13.5px] font-medium text-[var(--qf-brass-dark)]">
              Start the Beginner Journey
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </p>
          </Link>
          <Link
            href="/qfinance/beta"
            className="group rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 transition-colors hover:border-[var(--qf-brass)]"
          >
            <p className="font-display text-[15px] font-semibold text-[var(--qf-ink)]">Want to help shape QFinera?</p>
            <p className="mt-1 flex items-center gap-1 text-[13.5px] font-medium text-[var(--qf-brass-dark)]">
              Join the Beta
              <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </p>
          </Link>
        </div>
      </main>

      <QFinanceFooter />
    </div>
  );
}
