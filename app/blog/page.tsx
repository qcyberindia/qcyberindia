import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes on infrastructure, security, and running reliable systems.",
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <PageHeader eyebrow="Blog" title="Notes from the field" maxWidth="max-w-none" />

      <div className="mt-10 space-y-8">
        {posts.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="card block p-6">
            <p className="font-mono text-xs text-[var(--color-fog)]">
              {new Date(post.date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
            </p>
            <h2 className="mt-2 font-display text-xl font-bold text-[var(--color-navy)]">{post.title}</h2>
            <p className="mt-2 text-sm text-[var(--color-fog)]">{post.excerpt}</p>
          </Link>
        ))}
        {posts.length === 0 && <p className="text-[var(--color-fog)]">No posts yet — check back soon.</p>}
      </div>
    </div>
  );
}
