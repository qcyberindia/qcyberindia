import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { marked } from "marked";
import { getAllPosts, getPostBySlug } from "@/lib/blog";

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.meta.title,
    description: post.meta.excerpt,
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const html = marked.parse(post.content, { async: false }) as string;

  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-fog)] hover:text-[var(--color-red)] transition-colors"
      >
        <ArrowLeft size={16} />
        Back to blog
      </Link>

      <p className="mt-8 font-mono text-xs text-[var(--color-fog)]">
        {new Date(post.meta.date).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}
      </p>
      <h1 className="mt-2 font-display text-3xl md:text-4xl font-extrabold text-[var(--color-navy)]">
        {post.meta.title}
      </h1>
      <div
        className="prose mt-8 max-w-none prose-headings:font-display prose-a:text-[var(--color-red)] prose-strong:text-[var(--color-navy)]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
