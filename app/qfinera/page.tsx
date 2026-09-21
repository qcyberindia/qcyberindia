import Link from "next/link";
import { ArrowRight, Landmark, NotebookPen, FlaskConical } from "lucide-react";
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
  { icon: Landmark, label: "Portfolio", body: "See the holdings behind your investment thinking." },
  { icon: NotebookPen, label: "Journal", body: "Record why you invested, what changed, and what you believe now." },
  { icon: FlaskConical, label: "Research", body: "Build and organize the reasoning behind your investment thesis." },
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
              A New. <em className="italic text-[var(--qf-brass-dark)]">Financial.</em> Era.
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
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-[var(--qf-brass)] opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--qf-brass)]" />
                  </span>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--qf-brass-dark)]">
                    Live Today
                  </p>
                </div>
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
                  Ask something you&apos;ve been wondering about — you&apos;ll be the first.
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

      {/* Product vision — visually connected to the hero above via the same
          brass/cream language, but clearly a distinct, secondary section:
          tinted background, card treatment, explicit "being built" status
          so nothing here reads as available today. */}
      <section className="border-t border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              What&apos;s coming to {qfinanceConfig.name}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-center text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">
              The Community is live today. This is what we&apos;re building around it.
            </p>
          </Reveal>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {vision.map((v, i) => {
              const Icon = v.icon;
              return (
                <Reveal key={v.label} delay={i * 80}>
                  <div className="relative flex h-full flex-col rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-5">
                    <span className="absolute right-3 top-3 rounded-full border border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
                      Being built
                    </span>
                    <Icon size={20} className="text-[var(--qf-brass)]" />
                    <p className="mt-3 font-display text-[15px] font-semibold text-[var(--qf-ink)]">{v.label}</p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--qf-ink-soft)]">{v.body}</p>
                  </div>
                </Reveal>
              );
            })}
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
                Explore Community
                <ArrowRight size={15} />
              </Link>
              <Link href="/qfinera/beta" className="font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline">
                Join QFinera →
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <QFinanceFooter />
    </div>
  );
}
