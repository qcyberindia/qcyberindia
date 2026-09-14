"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, ExternalLink, EyeOff, Trash2, RotateCcw } from "lucide-react";
import AdminLoadingState from "@/components/admin/AdminLoadingState";
import AdminEmptyState from "@/components/admin/AdminEmptyState";

type AdminPost = {
  id: number;
  title: string;
  body: string;
  category: string;
  status: string;
  is_seed: boolean;
  created_at: string;
  author_display_name: string;
  author_email: string;
  reply_count: number;
};

const STATUS_STYLE: Record<string, string> = {
  published: "border-emerald-200 bg-emerald-50 text-emerald-700",
  hidden: "border-amber-200 bg-amber-50 text-amber-700",
  removed: "border-red-200 bg-red-50 text-red-700",
};

export default function AdminQFinanceCommunityPostsPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/admin/qfinance/community/posts")
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok) {
          setError(json.error || "Failed to load posts");
          return;
        }
        setError("");
        setPosts(json.posts);
      })
      .catch(() => setError("Failed to load posts"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: number, status: string) {
    const prev = posts;
    setPosts((p) => p.map((post) => (post.id === id ? { ...post, status } : post)));
    const res = await fetch("/api/admin/qfinance/community/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) setPosts(prev);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-red)]">
            QFinera · Community
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Posts
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/qfinance/community/reports"
            className="text-sm font-medium text-[var(--color-navy)] hover:underline"
          >
            View reports →
          </Link>
          <button
            onClick={() => {
              setLoading(true);
              load();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3.5 py-1.5 text-sm text-[var(--color-fog)] transition-colors hover:border-[var(--color-navy)]/40 hover:text-[var(--color-ink)] disabled:opacity-60"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-[var(--color-red)]/30 bg-[var(--color-red)]/5 px-3 py-2 text-sm text-[var(--color-red-deep)]">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {loading && <AdminLoadingState label="Loading posts…" />}
        {!loading && posts.length === 0 && <AdminEmptyState label="No community posts yet." />}
        {!loading &&
          posts.map((post) => (
            <div key={post.id} className="rounded-xl border border-[var(--color-line)] bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        STATUS_STYLE[post.status] ?? "border-[var(--color-line)] bg-white text-[var(--color-fog)]"
                      }`}
                    >
                      {post.status}
                    </span>
                    <span className="rounded-full border border-[var(--color-line)] bg-[var(--color-paper-2)] px-2 py-0.5 text-[11px] text-[var(--color-fog)]">
                      {post.category}
                    </span>
                    {post.is_seed && (
                      <span className="rounded-full border border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 px-2 py-0.5 text-[11px] text-[#8a5a00]">
                        Starter
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-medium text-[var(--color-ink)]">{post.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--color-fog)]">{post.body}</p>
                  <p className="mt-2 text-xs text-[var(--color-fog)]">
                    {post.author_display_name} ({post.author_email}) ·{" "}
                    {new Date(post.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                    {post.reply_count} {post.reply_count === 1 ? "reply" : "replies"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {post.status === "published" && (
                    <a
                      href={`/qfinance/community/${post.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 rounded-md border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-fog)] hover:border-[var(--color-navy)]/40 hover:text-[var(--color-ink)]"
                    >
                      <ExternalLink size={12} /> View
                    </a>
                  )}
                  {post.status !== "hidden" && (
                    <button
                      onClick={() => setStatus(post.id, "hidden")}
                      className="flex items-center gap-1 rounded-md border border-amber-200 px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-50"
                    >
                      <EyeOff size={12} /> Hide
                    </button>
                  )}
                  {post.status !== "removed" && (
                    <button
                      onClick={() => setStatus(post.id, "removed")}
                      className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  )}
                  {post.status !== "published" && (
                    <button
                      onClick={() => setStatus(post.id, "published")}
                      className="flex items-center gap-1 rounded-md border border-emerald-200 px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
                    >
                      <RotateCcw size={12} /> Restore
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
