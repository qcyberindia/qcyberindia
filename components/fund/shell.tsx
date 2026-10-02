"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Briefcase,
  Eye,
  FileText,
  LayoutDashboard,
  Menu,
  Receipt,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import { Drawer } from "@/components/fund/overlays";
import { NAV_ITEMS, POOLS_BASE, isNavActive, poolBase, visibleNav, type NavIcon } from "@/components/fund/nav";
import { useCan, useFund } from "@/components/fund/session";
import { humanize } from "@/components/fund/format";
import { StatusBadge } from "@/components/fund/display";
import { PRIVATE_POOL_NOTICE } from "@/lib/fund/product-gate";

const ICONS: Record<NavIcon, typeof Users> = {
  dashboard: LayoutDashboard,
  members: Users,
  contributions: ArrowDownToLine,
  withdrawals: ArrowUpFromLine,
  trades: ArrowLeftRight,
  holdings: Briefcase,
  watchlist: Eye,
  expenses: Receipt,
  reports: FileText,
  audit: ScrollText,
  settings: Settings,
};

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)]";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const can = useCan();
  const { poolId } = useFund();
  const pathname = usePathname();
  return (
    <nav aria-label="Pool sections">
      <ul className="space-y-0.5">
        {visibleNav(can).map((item) => {
          const Icon = ICONS[item.icon];
          const href = `${poolBase(poolId)}/${item.segment}`;
          const active = isNavActive(pathname, href);
          return (
            <li key={item.segment}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-[14px] font-medium transition-colors ${focusRing} ${
                  active
                    ? "bg-[var(--qf-cream-0)] text-[var(--qf-ink)] shadow-[0_1px_2px_rgba(43,38,33,0.06)]"
                    : "text-[var(--qf-ink-soft)] hover:bg-[var(--qf-cream-2)]/60 hover:text-[var(--qf-ink)]"
                }`}
              >
                {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[var(--qf-brass)]" />}
                <Icon size={16} className={active ? "text-[var(--qf-brass-dark)]" : ""} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function PoolSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { pools, poolId } = useFund();
  const others = pools.filter((p) => p.id !== poolId);
  return (
    <div className="space-y-1">
      <Link href={POOLS_BASE} onClick={onNavigate} className={`block rounded-md px-3 py-1.5 text-[13px] text-[var(--qf-brass-dark)] hover:underline ${focusRing}`}>
        All my pools
      </Link>
      {others.length > 0 && (
        <ul aria-label="Switch pool" className="space-y-0.5">
          {others.slice(0, 5).map((p) => (
            <li key={p.id}>
              <Link
                href={`${poolBase(p.id)}/dashboard`}
                onClick={onNavigate}
                className={`block truncate rounded-md px-3 py-1.5 text-[13px] text-[var(--qf-ink-soft)] hover:bg-[var(--qf-cream-1)] ${focusRing}`}
              >
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Phones and tablets: every section in one scrollable strip, active one marked. */
function SectionStrip() {
  const can = useCan();
  const { poolId } = useFund();
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  // Keep the active section in view; scrolls the strip only, never the page.
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-current="page"]');
    if (list && active) list.scrollLeft = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);
  return (
    <nav aria-label="Pool sections" className="border-b border-[var(--qf-line)] lg:hidden">
      <ul ref={listRef} className="relative flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:px-5 [&::-webkit-scrollbar]:hidden">
        {visibleNav(can).map((item) => {
          const Icon = ICONS[item.icon];
          const href = `${poolBase(poolId)}/${item.segment}`;
          const active = isNavActive(pathname, href);
          return (
            <li key={item.segment} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-1.5 border-b-2 px-2.5 text-[13.5px] font-medium transition-colors ${focusRing} ${
                  active
                    ? "border-[var(--qf-brass)] text-[var(--qf-ink)]"
                    : "border-transparent text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]"
                }`}
              >
                <Icon size={14} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function FundSidebar() {
  const { poolName, role, poolStatus } = useFund();
  return (
    <aside className="hidden border-r border-[var(--qf-line)] bg-[var(--qf-cream-1)] lg:block">
      <div className="sticky top-16 flex h-[calc(100dvh-4rem)] flex-col gap-6 overflow-y-auto p-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">Private pool</p>
          <p className="mt-1 truncate font-display text-[18px] font-semibold leading-tight text-[var(--qf-ink)]" title={poolName}>
            {poolName}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusBadge status={role} label={humanize(role)} />
            {poolStatus !== "active" && <StatusBadge status={poolStatus} />}
          </div>
        </div>
        <NavList />
        <div className="mt-auto border-t border-[var(--qf-line)] pt-3">
          <PoolSwitcher />
        </div>
      </div>
    </aside>
  );
}

function Breadcrumbs() {
  const { poolId, poolName } = useFund();
  const pathname = usePathname();
  const section = NAV_ITEMS.find((i) => isNavActive(pathname, `${poolBase(poolId)}/${i.segment}`));
  const isRecord = section && pathname !== `${poolBase(poolId)}/${section.segment}`;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px] text-[var(--qf-ink-soft)]">
        <li className="shrink-0">
          <Link href={POOLS_BASE} className={`hover:text-[var(--qf-ink)] ${focusRing}`}>Pools</Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="min-w-0 truncate">
          <Link href={`${poolBase(poolId)}/dashboard`} className={`font-medium text-[var(--qf-ink)] hover:underline ${focusRing}`}>{poolName}</Link>
        </li>
        {section && (
          <>
            <li aria-hidden="true" className="hidden sm:block">/</li>
            <li className="hidden shrink-0 sm:block">
              {isRecord ? (
                <Link href={`${poolBase(poolId)}/${section.segment}`} className={`hover:text-[var(--qf-ink)] ${focusRing}`}>{section.label}</Link>
              ) : (
                <span aria-current="page">{section.label}</span>
              )}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

/**
 * Page chrome for every pool screen, inside the one QFinera header: pool
 * sub-bar with breadcrumbs (and the section menu on phones), the section
 * sidebar on desktop, the main landmark, and the standing notice.
 */
export function FundShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { poolName, displayName, role } = useFund();
  return (
    <div className="min-h-dvh">
      <a
        href="#fund-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-[var(--qf-cream-0)] focus:px-3 focus:py-2 focus:text-sm focus:text-[var(--qf-ink)]"
      >
        Skip to content
      </a>
      <QFinanceHeader wide />
      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FundSidebar />
        <div className="min-w-0">
          <div className="flex min-h-12 items-center gap-3 border-b border-[var(--qf-line)] px-4 py-2 sm:px-6">
            <div className="min-w-0 flex-1">
              <Breadcrumbs />
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="All sections and pools"
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-[var(--qf-line)] px-3 text-[13px] font-medium text-[var(--qf-ink)] lg:hidden ${focusRing}`}
            >
              <Menu size={15} aria-hidden="true" /> <span className="hidden sm:inline">Menu</span>
            </button>
            <p className="hidden shrink-0 text-[12.5px] text-[var(--qf-ink-soft)] md:block">
              {displayName} <span aria-hidden="true">&middot;</span> {humanize(role)}
            </p>
          </div>
          <SectionStrip />
          <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title={poolName} description="Pool sections" side="left">
            <div className="space-y-6 p-3">
              <NavList onNavigate={() => setMenuOpen(false)} />
              <div className="border-t border-[var(--qf-line)] pt-3">
                <PoolSwitcher onNavigate={() => setMenuOpen(false)} />
              </div>
            </div>
          </Drawer>
          <main id="fund-main" tabIndex={-1} className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 outline-none sm:px-6">
            {children}
            <footer className="mt-12 border-t border-[var(--qf-line)] pt-4 text-[12px] leading-relaxed text-[var(--qf-ink-soft)]">
              {PRIVATE_POOL_NOTICE}
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
