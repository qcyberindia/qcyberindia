import Link from "next/link";
import Image from "next/image";

const links = [
  { href: "/solutions", label: "Solutions" },
  { href: "/services", label: "Services" },
  { href: "/industries", label: "Industries" },
  { href: "/why-qcyberindia", label: "Why Us" },
  { href: "/resources", label: "Resources" },
  { href: "/contact", label: "Contact" },
];

export default function Nav() {
  return (
    <header className="border-b border-[var(--color-line)] bg-[var(--color-paper)]/95 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-6 h-18 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="QCyberIndia" width={40} height={40} className="h-10 w-10 object-contain" priority />
          <span className="font-display font-bold text-lg tracking-tight">
          <span className="text-[var(--color-red)]">Q</span>
          <span className="text-[var(--color-navy)]">Cyber</span>
          <span className="text-[var(--color-gold)]">India</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[var(--color-fog)]">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[var(--color-navy)] transition-colors">
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/contact"
          className="hidden md:inline-flex items-center rounded-md bg-[var(--color-red)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-red-deep)] transition-colors"
        >
          Book a free assessment
        </Link>
      </div>
    </header>
  );
}
