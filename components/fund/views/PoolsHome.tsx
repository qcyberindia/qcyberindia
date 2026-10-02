// "My Pools": server-rendered from the signed-in user's own memberships.
import Link from "next/link";
import { ArrowRight, KeyRound, Lock, Mail, Plus, Users } from "lucide-react";
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
      <header className="mb-8 flex flex-col gap-4 border-b border-[var(--qf-line)]/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">QFinera Pools</p>
          <h1 className="mt-1 font-display text-[30px] font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[38px]">My pools</h1>
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
        <section aria-labelledby="inv-h" className="mb-8 overflow-hidden rounded-xl border border-[var(--qf-brass)]/45 bg-[var(--qf-brass)]/[0.07]">
          <div className="flex items-center gap-2.5 border-b border-[var(--qf-brass)]/25 px-4 py-3 sm:px-5">
            <Mail size={16} className="text-[var(--qf-brass-dark)]" aria-hidden="true" />
            <h2 id="inv-h" className="font-display text-[17px] font-semibold text-[var(--qf-ink)]">
              You have {invites.length === 1 ? "an invitation" : `${invites.length} invitations`}
            </h2>
          </div>
          <ul className="divide-y divide-[var(--qf-brass)]/20">
            {invites.map((i, n) => (
              <li key={n} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-[14px] sm:px-5">
                <span className="min-w-0">
                  <strong className="font-display text-[15.5px] font-semibold">{i.poolName}</strong>
                  <span className="text-[var(--qf-ink-soft)]"> as {humanize(i.role)}</span>
                </span>
                <span className="text-[12.5px] text-[var(--qf-ink-soft)]">
                  Expires <DateDisplay value={i.expiresAt.toISOString()} />
                </span>
              </li>
            ))}
          </ul>
          <p className="px-4 pb-3 text-[12.5px] text-[var(--qf-ink-soft)] sm:px-5">
            Open the link in the invitation email (or paste it under{" "}
            <Link href={`${POOLS_BASE}/join`} className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
              Join a pool
            </Link>
            ) to accept.
          </p>
        </section>
      )}

      {pools.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[var(--qf-line)] bg-[var(--qf-cream-1)]/40 px-6 py-16 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--qf-line)] bg-[var(--qf-cream-0)]">
            <Lock size={20} className="text-[var(--qf-brass-dark)]" aria-hidden="true" />
          </span>
          <p className="mt-4 font-display text-[22px] font-semibold text-[var(--qf-ink)]">You&rsquo;re not in a pool yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">
            Start a private pool for people you know and invite them by email, or join one with an invitation link.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <Link href={`${POOLS_BASE}/create`} className={btnPrimary}>
              <Plus size={16} aria-hidden="true" /> Create a pool
            </Link>
            <Link href={`${POOLS_BASE}/join`} className={btnSecondary}>
              <KeyRound size={16} aria-hidden="true" /> I have an invitation
            </Link>
          </div>
        </section>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {pools.map((p) => (
            <li key={p.id}>
              <Link
                href={`${poolBase(p.id)}/dashboard`}
                className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] shadow-[0_1px_2px_rgba(43,38,33,0.04)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[var(--qf-brass)] hover:shadow-[0_6px_20px_-8px_rgba(43,38,33,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)] motion-reduce:transform-none"
              >
                <div className="p-5 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">Private pool</p>
                      <p className="mt-1 truncate font-display text-[20px] font-semibold leading-tight text-[var(--qf-ink)]">{p.name}</p>
                    </div>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {p.status !== "active" && <StatusBadge status={p.status} />}
                      <StatusBadge status={p.membershipStatus === "active" ? p.role : p.membershipStatus} label={p.membershipStatus === "active" ? humanize(p.role) : undefined} />
                    </span>
                  </div>
                  {p.description && <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-[var(--qf-ink-soft)]">{p.description}</p>}
                  <div className="mt-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--qf-ink-soft)]">My value</p>
                      <p className="mt-0.5 font-display text-[26px] font-semibold leading-none tracking-tight text-[var(--qf-ink)]">
                        <MoneyDisplay value={p.myValue} />
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--qf-ink-soft)]">NAV / unit</p>
                      <p className="mt-0.5 text-[15px] font-semibold text-[var(--qf-ink)]">
                        {p.latestNav ? <MoneyDisplay value={p.latestNav.nav} dp={4} /> : <span className="font-normal text-[var(--qf-ink-soft)]">Not struck</span>}
                      </p>
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-2 border-t border-[var(--qf-line)]/70 bg-[var(--qf-cream-1)]/40 text-[13px]">
                  <div className="px-5 py-3">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--qf-ink-soft)]">My units</dt>
                    <dd className="mt-0.5 font-medium">
                      <QuantityDisplay value={p.myUnits} />
                    </dd>
                  </div>
                  <div className="border-l border-[var(--qf-line)]/70 px-5 py-3">
                    <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[var(--qf-ink-soft)]">Members</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 font-medium tabular-nums">
                      <Users size={13} className="text-[var(--qf-ink-soft)]" aria-hidden="true" />
                      {p.memberCount}
                    </dd>
                  </div>
                </dl>
                <p className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--qf-line)]/70 px-5 py-3 text-[12.5px] text-[var(--qf-ink-soft)]">
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
                    Open workspace <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
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
