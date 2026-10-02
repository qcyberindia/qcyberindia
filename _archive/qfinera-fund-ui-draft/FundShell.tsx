// The QFinera Fund frame: sidebar (desktop), header, bottom navigation
// (mobile), and the standing disclaimer. Only routes that actually exist are
// linked, so there are no dead links.
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/fund/ui";
import type { FundContext } from "@/lib/fund/auth";

export const FUND_BASE = "/qfinera/qfinera-fund";

export type NavKey = "dashboard" | "members" | "contributions";

const NAV: Array<{ key: NavKey; label: string; path: string }> = [
  { key: "dashboard", label: "Overview", path: `${FUND_BASE}/dashboard` },
  { key: "members", label: "Members", path: `${FUND_BASE}/members` },
  { key: "contributions", label: "Contributions", path: `${FUND_BASE}/contributions` },
];

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)]";

export function FundShell({
  ctx,
  active,
  children,
}: {
  ctx: FundContext;
  active: NavKey;
  children: ReactNode;
}) {
  // Keep the chosen fund in every link when the user belongs to several.
  const href = (path: string) => (ctx.funds.length > 1 ? `${path}?fund=${ctx.fund.id}` : path);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <a
        href="#fund-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[var(--qf-cream-0)] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <aside className="hidden border-r border-[var(--qf-line)] bg-[var(--qf-cream-1)] lg:flex lg:flex-col">
        <div className="px-5 py-6">
          <p className="font-display text-xl font-semibold">QFinera Fund</p>
          <p className="mt-1 text-sm text-[var(--qf-ink-soft)]">{ctx.fund.name}</p>
        </div>
        <nav aria-label="Fund sections" className="flex-1 px-3">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.key}>
                <Link
                  href={href(item.path)}
                  aria-current={item.key === active ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2 text-sm ${focus} ${
                    item.key === active
                      ? "bg-[var(--qf-cream-2)] font-semibold text-[var(--qf-ink)]"
                      : "text-[var(--qf-ink-soft)] hover:bg-[var(--qf-cream-2)]"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="px-5 py-4 text-xs text-[var(--qf-ink-soft)]">Private pooled-fund workspace</p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold lg:hidden">QFinera Fund</p>
            <p className="truncate text-sm text-[var(--qf-ink-soft)]">{ctx.fund.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {ctx.funds.length > 1 ? (
              <details className="relative">
                <summary className={`cursor-pointer rounded-lg border border-[var(--qf-line)] px-3 py-1.5 text-sm ${focus}`}>
                  Switch fund
                </summary>
                <ul className="absolute right-0 mt-2 w-56 rounded-lg border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-1 shadow-sm">
                  {ctx.funds.map((f) => (
                    <li key={f.id}>
                      <Link
                        href={`${FUND_BASE}/dashboard?fund=${f.id}`}
                        className={`block rounded-md px-3 py-2 text-sm hover:bg-[var(--qf-cream-2)] ${focus}`}
                      >
                        {f.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{ctx.displayName}</p>
            </div>
            <StatusBadge status={ctx.actor.role} />
          </div>
        </header>

        <main id="fund-main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
          {children}
          <footer className="mt-10 border-t border-[var(--qf-line)] pt-4 text-xs leading-relaxed text-[var(--qf-ink-soft)]">
            QFinera Fund is a private pooled-fund accounting and collaboration workspace. It does not provide
            investment advice. Tax figures are estimates only. Market data may be delayed or unavailable.
          </footer>
        </main>

        <nav
          aria-label="Fund sections"
          className="fixed inset-x-0 bottom-0 z-30 grid border-t border-[var(--qf-line)] bg-[var(--qf-cream-0)] lg:hidden"
          style={{ gridTemplateColumns: `repeat(${NAV.length}, minmax(0, 1fr))` }}
        >
          {NAV.map((item) => (
            <Link
              key={item.key}
              href={href(item.path)}
              aria-current={item.key === active ? "page" : undefined}
              className={`px-2 py-3.5 text-center text-sm ${focus} ${
                item.key === active ? "font-semibold text-[var(--qf-brass-dark)]" : "text-[var(--qf-ink-soft)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
