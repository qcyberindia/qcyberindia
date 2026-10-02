"use client";

// The QFinera product header, used by every /qfinera page: identity, the
// primary sections (Learn, Research, Community, Pools) with active state,
// theme, and account. On phones the sections live in the bottom tab bar
// (QFineraTabBar), so the top bar stays uncluttered.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { PRIMARY_NAV, isActive } from "./qfinera-nav";
import { useQFineraUser } from "./useQFineraUser";

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)]";

export default function QFinanceHeader({ wide = false }: { wide?: boolean }) {
  const pathname = usePathname();
  const { user, known } = useQFineraUser();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--qf-line)] bg-[var(--qf-cream-0)]/95 backdrop-blur">
      <nav aria-label="QFinera" className={`mx-auto flex h-14 items-center justify-between gap-4 px-4 sm:h-16 sm:px-6 ${wide ? "max-w-none" : "max-w-6xl"}`}>
        <Link href="/qfinera" aria-label="QFinera home" className={`rounded-sm font-display text-xl font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[22px] ${focus}`}>
          Q<em className="not-italic text-[var(--qf-brass)]">Finera</em>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-md px-3 py-2 text-[14px] font-medium transition-colors ${focus} ${
                    active ? "text-[var(--qf-ink)]" : "text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]"
                  }`}
                >
                  {item.label}
                  {active && <span aria-hidden="true" className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-[var(--qf-brass)] sm:-bottom-[17px]" />}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {!known ? (
            <span className="h-9 w-20" aria-hidden="true" />
          ) : user ? (
            <Link
              href="/qfinera/account"
              aria-current={pathname?.startsWith("/qfinera/account") ? "page" : undefined}
              className={`flex min-h-9 items-center gap-2 rounded-md border border-[var(--qf-line)] px-3 py-1.5 text-[13.5px] font-medium text-[var(--qf-ink)] hover:border-[var(--qf-brass)] ${focus}`}
            >
              <UserRound size={15} aria-hidden="true" />
              <span className="max-w-[9rem] truncate">{user.displayName}</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/qfinera/login" className={`hidden rounded-md px-3 py-2 text-[14px] font-medium text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)] sm:inline-block ${focus}`}>
                Sign in
              </Link>
              <Link
                href="/qfinera/register"
                className={`rounded-md bg-[var(--qf-brass-dark)] px-3.5 py-2 font-display text-[13.5px] font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90 ${focus}`}
              >
                Join QFinera
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
