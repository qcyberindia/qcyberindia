"use client";

// Mobile bottom navigation for all of QFinera (hidden from md up, where the
// header carries the sections). Large touch targets; safe-area aware.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Layers, MessagesSquare, UserRound } from "lucide-react";
import { isActive } from "./qfinera-nav";
import { useQFineraUser } from "./useQFineraUser";

export default function QFineraTabBar() {
  const pathname = usePathname();
  const { user } = useQFineraUser();
  const tabs = [
    { href: "/qfinera", label: "Home", icon: Home, match: ["/qfinera"], exact: true },
    { href: "/qfinera/learn/beginner", label: "Learn", icon: BookOpen, match: ["/qfinera/learn", "/qfinera/beginner", "/qfinera/research", "/qfinera/why-india-investing"] },
    { href: "/qfinera/community", label: "Community", icon: MessagesSquare, match: ["/qfinera/community"] },
    { href: "/qfinera/pools", label: "Pools", icon: Layers, match: ["/qfinera/pools"] },
    user
      ? { href: "/qfinera/account", label: "Account", icon: UserRound, match: ["/qfinera/account"] }
      : { href: "/qfinera/login", label: "Sign in", icon: UserRound, match: ["/qfinera/login", "/qfinera/register", "/qfinera/forgot-password", "/qfinera/reset-password", "/qfinera/verify-email"] },
  ];
  return (
    <nav
      aria-label="QFinera sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--qf-line)] bg-[var(--qf-cream-0)]/97 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = "exact" in t && t.exact ? pathname === t.href : isActive(pathname, t);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--qf-brass)] ${
                  active ? "text-[var(--qf-brass-dark)]" : "text-[var(--qf-ink-soft)]"
                }`}
              >
                <Icon size={19} aria-hidden="true" strokeWidth={active ? 2.25 : 1.75} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
