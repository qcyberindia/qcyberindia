import Link from "next/link";
import { MessageCircle, ArrowRight } from "lucide-react";
import type { QFinancePost } from "@/lib/db";
import RelativeTime from "./RelativeTime";

function replyCountText(count: number) {
  if (count === 0) return "0 replies";
  if (count === 1) return "1 reply";
  return `${count} replies`;
}

export default function PostCard({ post }: { post: QFinancePost }) {
  const ctaLabel = post.reply_count === 0 ? "Start the discussion" : "Join the discussion";

  return (
    <Link
      href={`/qfinera/community/${post.id}`}
      className="group block rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--qf-brass)] hover:shadow-sm active:translate-y-0 active:shadow-none"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-[var(--qf-line)] px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--qf-ink-soft)]">
          {post.category}
        </span>
        {post.is_seed && (
          <span className="rounded-full border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/10 px-2.5 py-0.5 text-[11.5px] font-medium text-[var(--qf-brass-dark)]">
            QFinera Starter Discussion
          </span>
        )}
      </div>

      <h3 className="mt-2.5 font-display text-lg font-semibold leading-snug text-[var(--qf-ink)]">
        {post.title}
      </h3>

      <div className="mt-2.5 flex items-center gap-2.5 text-[13px] text-[var(--qf-ink-soft)]">
        <span>{post.author_display_name}</span>
        <span aria-hidden>·</span>
        <RelativeTime iso={post.created_at} />
      </div>

      {/* Bottom row: real reply count as plain info, CTA as a visually
          distinct secondary action. Both live inside the same outer <Link>
          (the whole card navigates) — this is a styled <span>, not a
          nested <a>/<button>, so there's no invalid nested-interactive
          markup; the visual "button" affordance communicates intent
          without a second real link. */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--qf-line)]/70 pt-3">
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--qf-ink-soft)]">
          <MessageCircle size={13} />
          {replyCountText(post.reply_count)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/8 px-3 py-1 text-[12.5px] font-semibold text-[var(--qf-brass-dark)] transition-colors duration-200 group-hover:border-[var(--qf-brass)] group-hover:bg-[var(--qf-brass)]/15">
          {ctaLabel}
          <ArrowRight size={12} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
