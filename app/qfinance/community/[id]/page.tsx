import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { getQFinanceCommunityPost } from "@/lib/db";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import CommunityScope from "@/components/qfinance/community/CommunityScope";
import ReplyForm from "@/components/qfinance/community/ReplyForm";
import ReportButton from "@/components/qfinance/community/ReportButton";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getQFinanceCommunityPost(Number(id));
  // A hidden/removed/nonexistent post gets the same generic metadata as a
  // real 404 - nothing here should reveal whether a non-public post exists.
  if (!result) {
    return { title: "Question not found", robots: { index: false } };
  }
  return {
    title: result.post.title,
    description: result.post.body.slice(0, 155),
    alternates: { canonical: `/qfinance/community/${id}` },
  };
}

export default async function CommunityPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) notFound();

  const result = await getQFinanceCommunityPost(postId);
  if (!result) notFound();

  const { post, replies } = result;

  return (
    <div>
      <QFinanceHeader />

      <main className="mx-auto max-w-3xl px-6 py-14">
        <Link
          href="/qfinance/community"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[var(--qf-ink-soft)] transition-colors hover:text-[var(--qf-brass-dark)]"
        >
          <ArrowLeft size={13} />
          Community
        </Link>

        <CommunityScope>
          <article className="mt-6">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-[var(--qf-line)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--qf-ink-soft)]">
                {post.category}
              </span>
              {post.is_seed && (
                <span className="rounded-full border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/10 px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--qf-brass-dark)]">
                  QFinance Starter Discussion
                </span>
              )}
            </div>

            <h1 className="mt-3 font-display text-2xl font-bold leading-snug text-[var(--qf-ink)] sm:text-3xl">
              {post.title}
            </h1>

            <div className="mt-2.5 flex items-center gap-3 text-[13px] text-[var(--qf-ink-soft)]">
              <span>{post.author_display_name}</span>
              <span aria-hidden>·</span>
              <span>{formatDate(post.created_at)}</span>
            </div>

            <p className="mt-6 whitespace-pre-wrap text-[15.5px] leading-relaxed text-[var(--qf-ink)]">
              {post.body}
            </p>

            <div className="mt-4">
              <ReportButton targetType="post" targetId={post.id} />
            </div>
          </article>

          <section className="mt-12 border-t border-[var(--qf-line)] pt-8">
            <h2 className="flex items-center gap-1.5 font-display text-lg font-semibold text-[var(--qf-ink)]">
              <MessageCircle size={16} />
              {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
            </h2>

            <div className="mt-5 space-y-5">
              {replies.map((reply) => (
                <div key={reply.id} className="border-b border-[var(--qf-line)] pb-5 last:border-0">
                  <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-[var(--qf-ink)]">
                    {reply.body}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[12.5px] text-[var(--qf-ink-soft)]">
                    <span>{reply.author_display_name}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDate(reply.created_at)}</span>
                    <span aria-hidden>·</span>
                    <ReportButton targetType="reply" targetId={reply.id} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <ReplyForm postId={post.id} />
            </div>
          </section>
        </CommunityScope>
      </main>

      <QFinanceFooter />
    </div>
  );
}
