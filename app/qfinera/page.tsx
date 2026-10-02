import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Compass,
  FlaskConical,
  Layers,
  Lock,
  MessagesSquare,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { listQFinanceCommunityPosts } from "@/lib/db";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import PostCard from "@/components/qfinance/community/PostCard";
import AskQuestionButton from "@/components/qfinance/community/AskQuestionButton";
import Reveal from "@/components/Reveal";

// QFinera home: the gateway to every product area. Public and identical for
// every visitor, so it is statically rendered and regenerated at most once a
// minute (ISR); Community mutations also revalidate it immediately. Sign-in
// state is shown by the client-side header; protected areas authenticate
// on entry.
export const revalidate = 60;

const AREAS = [
  { href: "/qfinera/learn/beginner", icon: BookOpen, title: "Learn", body: "A beginner journey, one question at a time. Short chapters, plain language.", status: "Live" },
  { href: "/qfinera/community", icon: MessagesSquare, title: "Community", body: "Ask what you're trying to understand and discuss it with other investors.", status: "Live" },
  { href: "/qfinera/research", icon: FlaskConical, title: "Research", body: "Learn the concept, read the context, discuss it, and keep notes with your group.", status: "Live" },
  { href: "/qfinera/pools", icon: Layers, title: "Pools", body: "Private spaces for groups to keep pooled trading, accounting and portfolio records.", status: "Private" },
  { href: null, icon: Briefcase, title: "Portfolio", body: "Your own holdings in one place. We're building this next.", status: "Being built" },
  { href: "/qfinera/about", icon: Compass, title: "About", body: "Why QFinera exists, who builds it, and what it will never do.", status: "" },
] as const;

const JOURNEY = [
  { title: "Register", body: "One account, email and password." },
  { title: "Join QFinera", body: "Confirm your email and you're in." },
  { title: "Create or join a pool", body: "Start a private pool or accept an invite." },
  { title: "Discuss", body: "Ask and answer in the Community." },
  { title: "Research", body: "Learn, read context, keep shared notes." },
  { title: "Manage", body: "Contributions, trades, NAV and records." },
];

export default async function QFineraHomePage() {
  // A database hiccup should not take the gateway down: show the empty feed.
  const { posts, total } = await listQFinanceCommunityPosts({ page: 1 }).catch((err) => {
    console.error("QFinera: could not load the Community feed:", err);
    return { posts: [], total: 0 };
  });
  const featured = posts.slice(0, 4);

  return (
    <div>
      <QFinanceHeader />

      <section className="px-4 pb-12 pt-12 sm:px-6 sm:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h1 className="font-display text-[34px] font-semibold leading-[1.08] tracking-tight text-[var(--qf-ink)] sm:text-[52px]">
              A New. <em className="italic text-[var(--qf-brass-dark)]">Financial.</em> Era.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-[var(--qf-ink-soft)] sm:text-[17.5px]">
              Learn how investing works, discuss it with people who are figuring it out too, and keep honest, shared records with the people you
              invest alongside.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link href="/qfinera/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--qf-brass-dark)] px-6 font-display text-[15px] font-semibold text-[var(--qf-cream-0)] hover:opacity-90">
                Join QFinera <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/qfinera/learn/beginner" className="inline-flex min-h-12 items-center justify-center rounded-md border border-[var(--qf-line)] px-6 text-[15px] font-semibold text-[var(--qf-ink)] hover:border-[var(--qf-brass)]">
                Start learning
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="areas-h" className="border-t border-[var(--qf-line)] px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 id="areas-h" className="font-display text-[24px] font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[28px]">
            Everything in QFinera
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AREAS.map((a) => {
              const Icon = a.icon;
              const inner = (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <Icon size={20} className="text-[var(--qf-brass-dark)]" aria-hidden="true" />
                    {a.status && (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${
                          a.status === "Being built" ? "border-[var(--qf-line)] text-[var(--qf-ink-soft)]" : "border-[var(--qf-brass)]/50 bg-[var(--qf-brass)]/10 text-[var(--qf-brass-dark)]"
                        }`}
                      >
                        {a.status}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 font-display text-[18px] font-semibold text-[var(--qf-ink)]">{a.title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">{a.body}</p>
                </>
              );
              return (
                <li key={a.title}>
                  {a.href ? (
                    <Link
                      href={a.href}
                      className="block h-full rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-5 transition-colors hover:border-[var(--qf-brass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)]"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="h-full rounded-xl border border-dashed border-[var(--qf-line)] p-5 opacity-80">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="pools-h" className="border-t border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <Reveal>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">QFinera Pools</p>
            <h2 id="pools-h" className="mt-2 font-display text-[28px] font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[36px]">
              Private spaces for groups to organize pooled trading, accounting and portfolio records.
            </h2>
            <p className="mt-4 max-w-xl text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              Friends or family who invest together get one shared, accurate book: who put in what, units at an end-of-day NAV, every trade and
              expense, and a full audit trail. Invite-only, and QFinera never touches the money.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/qfinera/pools/create" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--qf-brass-dark)] px-5 font-display text-[15px] font-semibold text-[var(--qf-cream-0)] hover:opacity-90">
                Create a pool <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link href="/qfinera/pools" className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-5 text-[15px] font-semibold text-[var(--qf-ink)] hover:border-[var(--qf-brass)]">
                Open Pools
              </Link>
            </div>
          </Reveal>
          <ul className="grid gap-3">
            {[
              { icon: Lock, t: "Private and invite-only", b: "Never listed or searchable. Joining takes a single-use invite to your email." },
              { icon: ScrollText, t: "Accounting you can trust", b: "Units at end-of-day NAV, precise rounding, no negative cash, an append-only ledger and audit log." },
              { icon: ShieldCheck, t: "No advice, no custody", b: "No tips, signals or copy trading. Your group trades at its own broker; QFinera keeps the records." },
            ].map((p) => (
              <li key={p.t} className="flex gap-3 rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4">
                <p.icon size={19} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" aria-hidden="true" />
                <div>
                  <p className="font-display text-[16px] font-semibold text-[var(--qf-ink)]">{p.t}</p>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-[var(--qf-ink-soft)]">{p.b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="journey-h" className="border-t border-[var(--qf-line)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 id="journey-h" className="font-display text-[24px] font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[28px]">
            How it fits together
          </h2>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {JOURNEY.map((s, i) => (
              <li key={s.title} className="relative rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4">
                <span className="font-display text-[13px] font-semibold tabular-nums text-[var(--qf-brass-dark)]">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-1 font-display text-[16px] font-semibold text-[var(--qf-ink)]">{s.title}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--qf-ink-soft)]">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="community-h" className="border-t border-[var(--qf-line)] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">Community</p>
              <h2 id="community-h" className="mt-1.5 font-display text-[24px] font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[28px]">
                Questions investors are trying to understand.
              </h2>
            </div>
            <AskQuestionButton />
          </div>
          <div className="mt-8 space-y-3">
            {featured.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--qf-line)] p-10 text-center">
                <p className="font-display text-lg font-semibold text-[var(--qf-ink)]">Nothing to discuss yet.</p>
                <p className="mt-1.5 text-[14px] text-[var(--qf-ink-soft)]">Ask something you&apos;ve been wondering about. You&apos;ll be the first.</p>
              </div>
            ) : (
              featured.map((post) => <PostCard key={post.id} post={post} />)
            )}
          </div>
          {total > featured.length && (
            <Link href="/qfinera/community" className="mt-6 inline-flex min-h-10 items-center gap-1.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline">
              See all {total} questions <ArrowRight size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>

      <QFinanceFooter />
    </div>
  );
}
