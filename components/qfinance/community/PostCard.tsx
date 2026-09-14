import Link from "next/link";
import { MessageCircle } from "lucide-react";
import type { QFinancePost } from "@/lib/db";

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function PostCard({ post }: { post: QFinancePost }) {
  return (
    <Link
      href={`/qfinera/community/${post.id}`}
      className="block rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 transition-colors hover:border-[var(--qf-brass)]"
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
      <div className="mt-3 flex items-center gap-3 text-[13px] text-[var(--qf-ink-soft)]">
        <span>{post.author_display_name}</span>
        <span aria-hidden>·</span>
        <span>{timeAgo(post.created_at)}</span>
        <span aria-hidden>·</span>
        <span className="flex items-center gap-1">
          <MessageCircle size={13} />
          {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
        </span>
      </div>
    </Link>
  );
}
