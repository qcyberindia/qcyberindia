"use client";

// Mobile bottom navigation for all of QFinera (hidden from md up, where the
// header carries the sections). Large touch targets; safe-area aware.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Eye, FlaskConical, Layers, MessagesSquare } from "lucide-react";
import { isActive } from "./qfinera-nav";

// The five product sections. Home is the logo in the header; the account
// and sign-in live in the header on every screen size.
const TABS = [
  { href: "/qfinera/learn", label: "Learn", icon: BookOpen, match: ["/qfinera/learn", "/qfinera/beginner"] },
  { href: "/qfinera/research", label: "Research", icon: FlaskConical, match: ["/qfinera/research", "/qfinera/why-india-investing"] },
  { href: "/qfinera/watch", label: "Watch", icon: Eye, match: ["/qfinera/watch"] },
  { href: "/qfinera/community", label: "Community", icon: MessagesSquare, match: ["/qfinera/community"] },
  { href: "/qfinera/pools", label: "Pools", icon: Layers, match: ["/qfinera/pools"] },
] as const;

export default function QFineraTabBar() {
  const pathname = usePathname();
  const tabs = TABS;
  return (
    <nav
      aria-label="QFinera sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--qf-line)] bg-[var(--qf-cream-0)]/97 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const active = isActive(pathname, t);
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
