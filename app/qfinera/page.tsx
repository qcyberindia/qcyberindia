import Link from "next/link";
import { ArrowRight, Landmark, FlaskConical, Users } from "lucide-react";
import { listQFinanceCommunityPosts } from "@/lib/db";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import PostCard from "@/components/qfinance/community/PostCard";
import AskQuestionButton from "@/components/qfinance/community/AskQuestionButton";
import Reveal from "@/components/Reveal";

// Community-first homepage (see qfinance.md). The Community feed itself is
// the hero — no large marketing section precedes it. Fetches through the
// exact same listQFinanceCommunityPosts() the /qfinera/community page uses,
// and renders results with the same PostCard component, so this is a
// second *view* of Community, not a second Community implementation.

const roadmap = [
  {
    icon: Users,
    label: "Community",
    status: "live" as const,
    body: "Ask a question, discuss it with other investors, and get real replies — open now.",
  },
  {
    icon: Landmark,
    label: "Portfolio",
    status: "building" as const,
    body: "Connect your holdings — starting with Zerodha — and see them in one place.",
  },
  {
    icon: FlaskConical,
    label: "Research",
    status: "building" as const,
    body: "Turn a journal entry into an organized thesis — evidence, reasoning, conclusion.",
  },
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

      {/* Product story: Community is the live anchor everything else builds
          toward — one connected progression, not three equal feature cards.
          Only Community gets a filled/brass treatment + working CTA;
          Portfolio and Research are visibly quieter and explicitly
          "Being built" so nothing here reads as available today. */}
      <section className="border-t border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              Built around a live Community
            </p>
            <p className="mx-auto mt-2 max-w-sm text-center text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">
              Community is live today. Portfolio and Research are what we&apos;re building around it.
            </p>
          </Reveal>

          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {roadmap.map((v, i) => {
              const Icon = v.icon;
              const isLive = v.status === "live";
              return (
                <div key={v.label} className="flex flex-1 items-center gap-3">
                  <Reveal delay={i * 80} className="w-full">
                    <div
                      className={`relative flex h-full flex-col rounded-md border p-5 transition-colors ${
                        isLive
                          ? "border-[var(--qf-brass)] bg-[var(--qf-cream-0)] shadow-sm"
                          : "border-[var(--qf-line)] bg-[var(--qf-cream-0)]/60"
                      }`}
                    >
                      <span
                        className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          isLive
                            ? "border-[var(--qf-brass)]/50 bg-[var(--qf-brass)]/12 text-[var(--qf-brass-dark)]"
                            : "border-[var(--qf-line)] bg-[var(--qf-cream-1)] text-[var(--qf-ink-soft)]"
                        }`}
                      >
                        {isLive && (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-[var(--qf-brass)] opacity-60" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--qf-brass)]" />
                          </span>
                        )}
                        {isLive ? "Live today" : "Being built"}
                      </span>
                      <Icon size={20} className={isLive ? "mt-3 text-[var(--qf-brass)]" : "mt-3 text-[var(--qf-ink-soft)]"} />
                      <p className={`mt-2.5 font-display text-[15px] font-semibold ${isLive ? "text-[var(--qf-ink)]" : "text-[var(--qf-ink)]/80"}`}>
                        {v.label}
                      </p>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--qf-ink-soft)]">{v.body}</p>
                      {isLive && (
                        <Link
                          href="/qfinera/community"
                          className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--qf-brass)] px-4 py-2 font-display text-[13px] font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90"
                        >
                          Explore Community
                          <ArrowRight size={13} />
                        </Link>
                      )}
                    </div>
                  </Reveal>
                  {i < roadmap.length - 1 && (
                    <ArrowRight size={16} className="hidden shrink-0 text-[var(--qf-line)] sm:block" aria-hidden />
                  )}
                </div>
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
