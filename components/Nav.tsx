"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/solutions", label: "Solutions" },
  { href: "/services", label: "Services" },
  { href: "/industries", label: "Industries" },
  { href: "/why-qcyberindia", label: "Why Us" },
  { href: "/resources", label: "Resources" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-6 h-18 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Image src="/logo.png" alt="QCyberIndia" width={40} height={40} className="h-10 w-10 object-contain" priority />
          <span className="font-display font-bold text-lg tracking-tight">
            <span className="text-[var(--color-red)]">Q</span>
            <span className="text-[var(--color-navy)]">Cyber</span>
            <span className="text-[var(--color-gold)]">India</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--color-fog)]">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative transition-colors group ${
                  active ? "text-[var(--color-navy)]" : "hover:text-[var(--color-navy)]"
                }`}
              >
                {l.label}
                <span
                  className={`absolute -bottom-1 left-0 h-px bg-[var(--color-red)] transition-all duration-300 ${
                    active ? "w-full" : "w-0 group-hover:w-full"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <Link href="/contact" className="btn btn-primary hidden md:inline-flex">
          Book a free assessment
        </Link>

        {/* Mobile trigger */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--color-navy)] hover:bg-[var(--color-paper-2)] transition-colors"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden border-t border-[var(--color-line)] bg-[var(--color-paper)] transition-[max-height] duration-300 ease-in-out ${
          open ? "max-h-96" : "max-h-0 border-t-0"
        }`}
      >
        <nav className="flex flex-col px-6 py-4 gap-1">
          {links.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--color-paper-2)] text-[var(--color-navy)]"
                    : "text-[var(--color-fog)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-navy)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            href="/contact"
            onClick={() => setOpen(false)}
            className="btn btn-primary mt-3 justify-center"
          >
            Book a free assessment
          </Link>
        </nav>
      </div>
    </header>
  );
}
