import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listQFinanceCommunityPosts } from "@/lib/db";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import PostCard from "@/components/qfinance/community/PostCard";
import AskQuestionButton from "@/components/qfinance/community/AskQuestionButton";
import Reveal from "@/components/Reveal";
import { qfinanceConfig } from "@/lib/qfinance-config";

// Community-first homepage (see qfinance.md). The Community feed itself is
// the hero — no large marketing section precedes it. Fetches through the
// exact same listQFinanceCommunityPosts() the /qfinera/community page uses,
// and renders results with the same PostCard component, so this is a
// second *view* of Community, not a second Community implementation.

const vision = [
  { label: "Portfolio", status: "Being built", body: "Connect your investment view with the holdings you actually own." },
  { label: "Journal", status: "Being built", body: "Record why you invested, what changed, and what you believe now." },
  { label: "Research", status: "Being built", body: "Build and organize your own investment thesis." },
];

export default async function QFineraHomePage() {
  const { posts, total } = await listQFinanceCommunityPosts({ page: 1 });
  const featured = posts.slice(0, 6);

  return (
    <div>
      <QFinanceHeader />

      {/* Compact positioning \u2014 not a full-viewport marketing hero.
          Transitions into the Community feed within the same scroll. */}
      <section className="px-6 pt-14 pb-8 sm:pt-16">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <h1 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-[var(--qf-ink)] sm:text-[40px]">
              A New. <em className="font-light italic text-[var(--qf-brass-dark)]">Financial.</em> Era.
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              A private room for investors to discuss, research, record, and improve their
              investment thinking.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Community as hero */}
      <section className="border-t border-[var(--qf-line)] px-6 py-12 sm:py-14">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
                  Live today
                </p>
                <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[28px]">
                  Questions investors are trying to understand.
                </h2>
              </div>
              <AskQuestionButton />
            </div>
          </Reveal>

          <div className="mt-8 space-y-3">
            {featured.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--qf-line)] p-10 text-center">
                <p className="font-display text-lg font-semibold text-[var(--qf-ink)]">Nothing to discuss yet.</p>
                <p className="mt-1.5 text-[14px] text-[var(--qf-ink-soft)]">
                  Ask something you&apos;ve been wondering about \u2014 you&apos;ll be the first.
                </p>
              </div>
            ) : (
              featured.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </div>

          {total > featured.length && (
            <Link
              href="/qfinera/community"
              className="mt-6 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline"
            >
              See all {total} questions
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </section>

      {/* Compact product vision \u2014 secondary to Community, honestly labeled */}
      <section className="border-t border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              What&apos;s coming to {qfinanceConfig.name}
            </p>
          </Reveal>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {vision.map((v, i) => (
              <Reveal key={v.label} delay={i * 80}>
                <div className="border-t border-[var(--qf-line)] pt-4">
                  <p className="font-display text-[15px] font-semibold text-[var(--qf-ink)]">{v.label}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--qf-ink-soft)]">{v.status}</p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--qf-ink-soft)]">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[var(--qf-line)] px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-lg text-center">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[30px]">
              Your investment thinking deserves a place of its own.
            </h2>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/qfinera/community"
                className="inline-flex items-center gap-2 rounded-sm bg-[var(--qf-brass)] px-6 py-3 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90"
              >
                Explore QFinera
                <ArrowRight size={15} />
              </Link>
              <Link href="/qfinera/beta" className="font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline">
                Join the Beta →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <QFinanceFooter />
    </div>
  );
}
