"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/qfinera/community", label: "Community" },
  { href: "/qfinera/learn/beginner", label: "Learn" },
  { href: "/qfinera/about", label: "About" },
];

export default function QFinanceHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--qf-line)] bg-[var(--qf-cream-0)]/95 backdrop-blur">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 sm:py-[18px]">
        <Link
          href="/qfinera"
          className="font-display text-xl font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[22px]"
          aria-label="QFinera home"
          onClick={() => setOpen(false)}
        >
          Q<em className="not-italic text-[var(--qf-brass)]">Finera</em>
        </Link>

        <div className="flex items-center gap-4 sm:gap-5">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`hidden text-sm font-medium transition-colors sm:inline ${
                  active ? "text-[var(--qf-brass-dark)]" : "text-[var(--qf-ink-soft)] hover:text-[var(--qf-brass-dark)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}

          <ThemeToggle />

          <Link
            href="/qfinera/beta"
            className="rounded-sm bg-[var(--qf-brass)] px-4 py-2.5 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90"
          >
            Join QFinera
          </Link>

          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-[var(--qf-ink)] hover:bg-[var(--qf-cream-1)] sm:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      <div
        className={`overflow-hidden border-t border-[var(--qf-line)] bg-[var(--qf-cream-0)] transition-[max-height] duration-300 ease-in-out sm:hidden ${
          open ? "max-h-60" : "max-h-0 border-t-0"
        }`}
      >
        <div className="flex flex-col px-6 py-3">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`rounded-sm px-2 py-2.5 text-sm font-medium ${
                  active ? "text-[var(--qf-brass-dark)]" : "text-[var(--qf-ink-soft)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
