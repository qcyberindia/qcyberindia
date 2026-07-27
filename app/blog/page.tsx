import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes on infrastructure, security, and running reliable systems.",
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-sm text-[var(--color-red)] mb-4">BLOG</p>
      <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--color-navy)]">
        Notes from the field
      </h1>

      <div className="mt-10 space-y-8">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="block rounded-lg border border-[var(--color-line)] bg-[#ffffff] p-6 hover:border-[var(--color-red)]/50 transition-colors"
          >
            <p className="font-mono text-xs text-[var(--color-fog)]">
              {new Date(post.date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <h2 className="mt-2 font-display text-xl font-medium text-[var(--color-navy)]">{post.title}</h2>
            <p className="mt-2 text-sm text-[var(--color-fog)]">{post.excerpt}</p>
          </Link>
        ))}
        {posts.length === 0 && <p className="text-[var(--color-fog)]">No posts yet — check back soon.</p>}
      </div>
    </div>
  );
}
