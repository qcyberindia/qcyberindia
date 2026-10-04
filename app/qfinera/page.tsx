import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Eye,
  FlaskConical,
  Layers,
  ListChecks,
  MessagesSquare,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { listQFinanceCommunityPosts } from "@/lib/db";
import { chapters } from "@/lib/qfinance-chapters";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import PostCard from "@/components/qfinance/community/PostCard";

// QFinera home. Public and identical for every visitor, so it is statically
// rendered and regenerated at most once a minute (ISR); Community mutations
// also revalidate it. Sign-in state lives in the client-side header.
export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: "QFinera — Research. Learn. Share. Manage." },
  description:
    "Learn how investing works, research companies, share useful findings with other investors, and keep honest records of money you invest together.",
};

const PILLARS = [
  { href: "/qfinera/learn", icon: BookOpen, title: "Learn", line: "Understand investing in short, plain-language chapters." },
  { href: "/qfinera/research", icon: FlaskConical, title: "Research", line: "Read a company, an industry and the economy." },
  { href: "/qfinera/watch", icon: Eye, title: "Global Watch", line: "Share and discover useful findings." },
  { href: "/qfinera/community", icon: MessagesSquare, title: "Community", line: "Ask questions and discuss them." },
  { href: "/qfinera/pools", icon: Layers, title: "Pools", line: "Manage a fund you invest in together." },
] as const;

const STEPS = [
  { title: "Create a free account", body: "Email and password. That's it." },
  { title: "Learn the basics", body: "Eight short chapters, at your pace." },
  { title: "Research and share", body: "Follow companies; post what you find to Global Watch." },
  { title: "Invest together", body: "Start a pool with people you know and keep one fair record." },
];

const PRINCIPLES = [
  { icon: Sparkles, title: "No tips, no signals", body: "QFinera explains and records. It never tells you what to buy." },
  { icon: Wallet, title: "We never hold your money", body: "Your group invests through its own bank and broker. QFinera keeps the books." },
  { icon: ScrollText, title: "Every change is on record", body: "Pool records are append-only, with who, when, what changed and why." },
  { icon: ShieldCheck, title: "Honest numbers", body: "No live-price theatre. Prices are recorded with their date; missing ones stay missing." },
];

const cta =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 text-[15px] font-semibold transition-[opacity,border-color] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)]";

function SectionHead({ eyebrow, title, body, id }: { eyebrow: string; title: string; body: string; id: string }) {
  return (
    <div className="max-w-xl">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">{eyebrow}</p>
      <h2 id={id} className="mt-2 font-display text-[28px] font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[34px]">
        {title}
      </h2>
      <p className="mt-3 text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">{body}</p>
    </div>
  );
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mt-5 inline-flex min-h-10 items-center gap-1.5 font-display text-[15px] font-semibold text-[var(--qf-brass-dark)] hover:underline">
      {children} <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}

/** A small, clearly-labelled illustration of a pool's figures. Not real data. */
function PoolIllustration() {
  const bars = [38, 44, 41, 52, 58, 55, 63, 70];
  return (
    <figure className="rounded-2xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-5 shadow-[0_10px_30px_-18px_rgba(43,38,33,0.35)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--qf-ink-soft)]">NAV per unit</p>
          <p className="mt-1 font-display text-[28px] font-semibold tabular-nums text-[var(--qf-ink)]">₹12.4810</p>
        </div>
        <span className="rounded-full border border-[var(--qf-line)] px-2 py-0.5 text-[11px] text-[var(--qf-ink-soft)]">Example</span>
      </div>
      <div className="mt-4 flex h-24 items-end gap-1.5" aria-hidden="true">
        {bars.map((h, i) => (
          <span key={i} className="flex-1 rounded-t bg-[var(--qf-chart-1)]" style={{ height: `${h}%`, opacity: 0.35 + i * 0.08 }} />
        ))}
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--qf-line)] pt-4 text-[12.5px]">
        <div>
          <dt className="text-[var(--qf-ink-soft)]">Members</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-[var(--qf-ink)]">6</dd>
        </div>
        <div>
          <dt className="text-[var(--qf-ink-soft)]">Pool value</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-[var(--qf-ink)]">₹4.2L</dd>
        </div>
        <div>
          <dt className="text-[var(--qf-ink-soft)]">Approvals</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-[var(--qf-ink)]">1 waiting</dd>
        </div>
      </dl>
      <figcaption className="mt-4 text-[12px] text-[var(--qf-ink-soft)]">Illustration of a pool dashboard. Figures are examples.</figcaption>
    </figure>
  );
}

/** What a Global Watch post looks like. Illustration, not a real post. */
function WatchIllustration() {
  return (
    <figure className="rounded-2xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-5 shadow-[0_10px_30px_-18px_rgba(43,38,33,0.35)] sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-[var(--qf-brass)]/12 px-2 py-0.5 text-[11.5px] font-semibold text-[var(--qf-brass-dark)]">Industry</span>
        <span className="rounded-full border border-[var(--qf-line)] px-2 py-0.5 text-[11px] text-[var(--qf-ink-soft)]">Example</span>
      </div>
      <p className="mt-3 font-display text-[18px] font-semibold leading-snug text-[var(--qf-ink)]">New rules for solar module imports from April</p>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">
        The notification changes which manufacturers can supply government projects. Worth reading before looking at the sector.
      </p>
      <div className="mt-4 space-y-2">
        {["Ministry notification (PDF)", "Industry body explainer (video)"].map((l) => (
          <p key={l} className="flex items-center gap-2 rounded-lg border border-[var(--qf-line)] px-3 py-2 text-[13px] text-[var(--qf-ink)]">
            <ScrollText size={14} className="text-[var(--qf-brass-dark)]" aria-hidden="true" /> {l}
          </p>
        ))}
      </div>
      <figcaption className="mt-4 text-[12px] text-[var(--qf-ink-soft)]">Shared by a member · #solar #policy</figcaption>
    </figure>
  );
}

export default async function QFineraHomePage() {
  // A database hiccup should not take the home page down: show no posts.
  const { posts, total } = await listQFinanceCommunityPosts({ page: 1 }).catch((err) => {
    console.error("QFinera: could not load the Community feed:", err);
    return { posts: [], total: 0 };
  });
  const featured = posts.slice(0, 3);

  return (
    <div>
      <QFinanceHeader />

      <main id="main">
        {/* 1. Hero */}
        <section aria-labelledby="hero-h" className="px-4 pb-14 pt-12 sm:px-6 sm:pb-20 sm:pt-20">
          <div className="mx-auto max-w-4xl text-center">
            <p className="font-display text-[15px] font-semibold tracking-tight text-[var(--qf-brass-dark)]">QFinera</p>
            <h1 id="hero-h" className="mt-3 font-display text-[40px] font-semibold leading-[1.05] tracking-tight text-[var(--qf-ink)] sm:text-[64px]">
              Research. Learn. <em className="italic text-[var(--qf-brass-dark)]">Share.</em> Manage.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-[16.5px] leading-relaxed text-[var(--qf-ink-soft)] sm:text-[18px]">
              For Indian investors who want to understand what they invest in. Learn the basics, research companies, share what you find, and keep honest
              records of money you invest together.
            </p>
            <nav aria-label="Start with" className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Link href="/qfinera/learn" className={`${cta} bg-[var(--qf-brass-dark)] text-[var(--qf-cream-0)] hover:opacity-90`}>
                Start learning
              </Link>
              <Link href="/qfinera/research" className={`${cta} border border-[var(--qf-line)] text-[var(--qf-ink)] hover:border-[var(--qf-brass)]`}>
                Explore Research
              </Link>
              <Link href="/qfinera/community" className={`${cta} border border-[var(--qf-line)] text-[var(--qf-ink)] hover:border-[var(--qf-brass)]`}>
                Explore Community
              </Link>
              <Link href="/qfinera/pools" className={`${cta} border border-[var(--qf-line)] text-[var(--qf-ink)] hover:border-[var(--qf-brass)]`}>
                Explore Pools
              </Link>
            </nav>
            <p className="mt-5 text-[14px] text-[var(--qf-ink-soft)]">
              New here?{" "}
              <Link href="/qfinera/register" className="font-semibold text-[var(--qf-brass-dark)] underline-offset-2 hover:underline">
                Get started free
              </Link>
            </p>
          </div>
        </section>

        {/* 2. What QFinera helps you do */}
        <section aria-labelledby="pillars-h" className="border-t border-[var(--qf-line)] bg-[var(--qf-cream-1)]/60 px-4 py-14 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 id="pillars-h" className="font-display text-[24px] font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[28px]">
              What you can do here
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {PILLARS.map((p) => (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    className="group flex h-full flex-col rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-5 transition-colors hover:border-[var(--qf-brass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)]"
                  >
                    <p.icon size={22} className="text-[var(--qf-brass-dark)]" aria-hidden="true" />
                    <span className="mt-3 font-display text-[18px] font-semibold text-[var(--qf-ink)]">{p.title}</span>
                    <span className="mt-1 flex-1 text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">{p.line}</span>
                    <ArrowRight size={15} className="mt-3 text-[var(--qf-brass-dark)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 3. Learn */}
        <section aria-labelledby="learn-h" className="border-t border-[var(--qf-line)] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:grid lg:grid-cols-2 lg:items-center [&>*]:min-w-0">
            <div>
              <SectionHead
                id="learn-h"
                eyebrow="Learn"
                title="Investing, without the textbook."
                body="Eight short chapters that answer the questions beginners actually have, from “is this safe?” to placing a practice order."
              />
              <TextLink href="/qfinera/learn">Start learning</TextLink>
            </div>
            <ol className="space-y-2">
              {chapters.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/qfinera/learn/beginner/${c.slug}`}
                    className="flex items-center gap-4 rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-4 py-3 transition-colors hover:border-[var(--qf-brass)]"
                  >
                    <span className="font-display text-[15px] font-semibold tabular-nums text-[var(--qf-brass-dark)]">{c.number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[var(--qf-ink)]">{c.title}</span>
                      <span className="block truncate text-[13px] text-[var(--qf-ink-soft)]">{c.question}</span>
                    </span>
                    <span className="shrink-0 text-[12px] text-[var(--qf-ink-soft)]">{c.estMinutes} min</span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 4. Research */}
        <section aria-labelledby="research-h" className="border-t border-[var(--qf-line)] bg-[var(--qf-cream-1)]/60 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:grid lg:grid-cols-2 lg:items-center [&>*]:min-w-0">
            <ul className="order-2 grid gap-3 sm:grid-cols-3 lg:order-1">
              {[
                { t: "Company", b: "What it sells, how it earns, what could go wrong." },
                { t: "Industry", b: "Who competes, what drives demand, what regulates it." },
                { t: "Economy", b: "Rates, inflation and policy, and why they matter." },
              ].map((x) => (
                <li key={x.t} className="rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-4">
                  <p className="font-display text-[16px] font-semibold text-[var(--qf-ink)]">{x.t}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--qf-ink-soft)]">{x.b}</p>
                </li>
              ))}
            </ul>
            <div className="order-1 lg:order-2">
              <SectionHead
                id="research-h"
                eyebrow="Research"
                title="Look before you invest."
                body="Learn the concept, read the context, and discuss it. Research is about understanding a business, not guessing a price."
              />
              <TextLink href="/qfinera/research">Explore Research</TextLink>
            </div>
          </div>
        </section>

        {/* 5. Global Watch */}
        <section aria-labelledby="watch-h" className="border-t border-[var(--qf-line)] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:grid lg:grid-cols-2 lg:items-center [&>*]:min-w-0">
            <div>
              <SectionHead
                id="watch-h"
                eyebrow="Global Watch"
                title="One member finds it. Everyone benefits."
                body="An announcement, a useful article, a management interview, a new rule, a risk. Members share what they find, with the source, so others can understand it and decide for themselves."
              />
              <TextLink href="/qfinera/watch">Explore Global Watch</TextLink>
            </div>
            <WatchIllustration />
          </div>
        </section>

        {/* 6. Community */}
        <section aria-labelledby="community-h" className="border-t border-[var(--qf-line)] bg-[var(--qf-cream-1)]/60 px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionHead
                id="community-h"
                eyebrow="Community"
                title="Ask what you're trying to understand."
                body="Questions and discussions from people learning to invest. No question is too basic."
              />
              <Link href="/qfinera/community" className={`${cta} shrink-0 border border-[var(--qf-line)] bg-[var(--qf-cream-0)] text-[var(--qf-ink)] hover:border-[var(--qf-brass)]`}>
                Join the discussion
              </Link>
            </div>
            <div className="mt-8 grid gap-3 lg:grid-cols-3">
              {featured.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--qf-line)] p-8 text-center lg:col-span-3">
                  <p className="font-display text-lg font-semibold text-[var(--qf-ink)]">No questions yet.</p>
                  <p className="mt-1.5 text-[14px] text-[var(--qf-ink-soft)]">Ask something you&apos;ve been wondering about. You&apos;ll be the first.</p>
                </div>
              ) : (
                featured.map((post) => <PostCard key={post.id} post={post} />)
              )}
            </div>
            {total > featured.length && (
              <TextLink href="/qfinera/community">See all {total} questions</TextLink>
            )}
          </div>
        </section>

        {/* 7. Pools */}
        <section aria-labelledby="pools-h" className="border-t border-[var(--qf-line)] px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:grid lg:grid-cols-2 lg:items-center [&>*]:min-w-0">
            <div>
              <SectionHead
                id="pools-h"
                eyebrow="Pools"
                title="Invest together. Keep one fair record."
                body="Friends or family who pool money get one accurate book: who put in what, units at a daily NAV, every trade and expense, and approvals with a full audit trail."
              />
              <ul className="mt-5 space-y-2 text-[14.5px] text-[var(--qf-ink)]">
                {["Viewer, Member, Manager and Admin roles", "Manager changes wait for an admin's approval", "Dashboard with NAV history, flows and holdings"].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <ListChecks size={16} className="mt-0.5 shrink-0 text-[var(--qf-brass-dark)]" aria-hidden="true" />
                    {x}
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Link href="/qfinera/pools" className={`${cta} bg-[var(--qf-brass-dark)] text-[var(--qf-cream-0)] hover:opacity-90`}>
                  Explore Pools <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <Link href="/qfinera/learn/pool-guide" className={`${cta} border border-[var(--qf-line)] text-[var(--qf-ink)] hover:border-[var(--qf-brass)]`}>
                  Read the Pool Guide
                </Link>
              </div>
            </div>
            <PoolIllustration />
          </div>
        </section>

        {/* 8. How it works */}
        <section aria-labelledby="how-h" className="border-t border-[var(--qf-line)] bg-[var(--qf-cream-1)]/60 px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 id="how-h" className="font-display text-[24px] font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[28px]">
              How it works
            </h2>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-5">
                  <span className="font-display text-[14px] font-semibold tabular-nums text-[var(--qf-brass-dark)]">{String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-1 font-display text-[17px] font-semibold text-[var(--qf-ink)]">{s.title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 9. Principles */}
        <section aria-labelledby="trust-h" className="border-t border-[var(--qf-line)] px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 id="trust-h" className="font-display text-[24px] font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[28px]">
              What we stand by
            </h2>
            <ul className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {PRINCIPLES.map((p) => (
                <li key={p.title}>
                  <p.icon size={20} className="text-[var(--qf-brass-dark)]" aria-hidden="true" />
                  <p className="mt-2 font-display text-[16.5px] font-semibold text-[var(--qf-ink)]">{p.title}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">{p.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 10. CTA + 11. About */}
        <section aria-labelledby="join-h" className="border-t border-[var(--qf-line)] px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-4xl rounded-2xl border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/[0.07] px-6 py-10 text-center sm:px-12">
            <h2 id="join-h" className="font-display text-[28px] font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[34px]">
              Start with one question.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              A free account gives you Community, Global Watch and Pools. Learn is open to everyone.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Link href="/qfinera/register" className={`${cta} bg-[var(--qf-brass-dark)] text-[var(--qf-cream-0)] hover:opacity-90`}>
                Join QFinera
              </Link>
              <Link href="/qfinera/learn" className={`${cta} border border-[var(--qf-line)] bg-[var(--qf-cream-0)] text-[var(--qf-ink)] hover:border-[var(--qf-brass)]`}>
                Start learning
              </Link>
            </div>
          </div>
          <p className="mx-auto mt-10 max-w-2xl text-center text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">
            QFinera is built in India by QCyberIndia, for people who would rather understand an investment than be told what to buy.{" "}
            <Link href="/qfinera/about" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
              About QFinera
            </Link>{" "}
            ·{" "}
            <Link href="/qfinera/roadmap" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
              What&apos;s next
            </Link>
          </p>
        </section>
      </main>

      <QFinanceFooter />
    </div>
  );
}
