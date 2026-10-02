// "My Pools": server-rendered from the signed-in user's own memberships.
import Link from "next/link";
import { ArrowRight, KeyRound, Lock, Plus } from "lucide-react";
import { DateDisplay, MoneyDisplay, QuantityDisplay, StatusBadge } from "@/components/fund/display";
import { humanize } from "@/components/fund/format";
import { POOLS_BASE, poolBase } from "@/components/fund/nav";
import { btnPrimary, btnSecondary } from "@/components/fund/parts";
import type { PoolSummary } from "@/lib/fund/services/pools";

type Invite = { poolName: string; role: string; expiresAt: Date };

export function PoolsHome({ pools, invites, welcome }: { pools: PoolSummary[]; invites: Invite[]; welcome: boolean }) {
  return (
    <>
      {welcome && (
        <p role="status" className="mb-6 rounded-lg border border-[var(--qf-fix)]/30 bg-[var(--qf-fix-bg)] px-4 py-3 text-[14px] text-[var(--qf-ink)]">
          Your account is ready. Create a pool, or open an invitation link from your email to join one.
        </p>
      )}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--qf-brass-dark)]">QFinera Pools</p>
          <h1 className="mt-1 font-display text-[30px] font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[36px]">My pools</h1>
          <p className="mt-1 max-w-2xl text-[14.5px] leading-relaxed text-[var(--qf-ink-soft)]">
            Private spaces for your groups. Each pool keeps its own members, capital, units, NAV, trades and records, visible only to its members.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`${POOLS_BASE}/create`} className={btnPrimary}>
            <Plus size={16} aria-hidden="true" /> Create a pool
          </Link>
          <Link href={`${POOLS_BASE}/join`} className={btnSecondary}>
            <KeyRound size={16} aria-hidden="true" /> Join a pool
          </Link>
        </div>
      </header>

      {invites.length > 0 && (
        <section aria-labelledby="inv-h" className="mb-8 rounded-lg border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/10 p-4 sm:p-5">
          <h2 id="inv-h" className="font-display text-[17px] font-semibold text-[var(--qf-ink)]">You have {invites.length === 1 ? "an invitation" : `${invites.length} invitations`}</h2>
          <ul className="mt-2 space-y-1.5 text-[14px]">
            {invites.map((i, n) => (
              <li key={n}>
                <strong>{i.poolName}</strong> as {humanize(i.role)} <span className="text-[var(--qf-ink-soft)]">· expires <DateDisplay value={i.expiresAt.toISOString()} /></span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-[var(--qf-ink-soft)]">Open the link in the invitation email (or paste it under &ldquo;Join a pool&rdquo;) to accept.</p>
        </section>
      )}

      {pools.length === 0 ? (
        <section className="rounded-xl border border-dashed border-[var(--qf-line)] px-6 py-14 text-center">
          <Lock size={22} className="mx-auto text-[var(--qf-brass-dark)]" aria-hidden="true" />
          <p className="mt-3 font-display text-[20px] font-semibold text-[var(--qf-ink)]">You&rsquo;re not in a pool yet</p>
          <p className="mx-auto mt-1 max-w-md text-[14px] text-[var(--qf-ink-soft)]">
            Start a private pool for people you know and invite them by email, or join one with an invitation link.
          </p>
          <Link href={`${POOLS_BASE}/create`} className={`${btnPrimary} mt-5`}>
            Create a pool
          </Link>
        </section>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {pools.map((p) => (
            <li key={p.id}>
              <Link
                href={`${poolBase(p.id)}/dashboard`}
                className="group flex h-full flex-col rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-5 transition-colors hover:border-[var(--qf-brass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 font-display text-[19px] font-semibold text-[var(--qf-ink)]">{p.name}</p>
                  <span className="flex shrink-0 gap-1.5">
                    {p.status !== "active" && <StatusBadge status={p.status} />}
                    <StatusBadge status={p.membershipStatus === "active" ? p.role : p.membershipStatus} label={p.membershipStatus === "active" ? humanize(p.role) : undefined} />
                  </span>
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-[13.5px] text-[var(--qf-ink-soft)]">{p.description}</p>}
                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px] sm:grid-cols-4">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">NAV</dt>
                    <dd className="mt-0.5">{p.latestNav ? <MoneyDisplay value={p.latestNav.nav} dp={4} /> : <span className="text-[var(--qf-ink-soft)]">Not struck</span>}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">My value</dt>
                    <dd className="mt-0.5">
                      <MoneyDisplay value={p.myValue} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">My units</dt>
                    <dd className="mt-0.5">
                      <QuantityDisplay value={p.myUnits} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">Members</dt>
                    <dd className="mt-0.5 tabular-nums">{p.memberCount}</dd>
                  </div>
                </dl>
                <p className="mt-auto flex items-center justify-between gap-2 pt-5 text-[12.5px] text-[var(--qf-ink-soft)]">
                  <span>
                    {p.lastActivityAt ? (
                      <>
                        Last activity <DateDisplay value={p.lastActivityAt.toISOString()} />
                      </>
                    ) : (
                      "No activity yet"
                    )}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-[var(--qf-brass-dark)]">
                    Open <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
