import Link from "next/link";
import { qfinanceConfig } from "@/lib/qfinance-config";

const LINKS = [
  { href: "/qfinera/learn/beginner", label: "Learn" },
  { href: "/qfinera/research", label: "Research" },
  { href: "/qfinera/community", label: "Community" },
  { href: "/qfinera/pools", label: "Pools" },
  { href: "/qfinera/why-india-investing", label: "Why India Is Investing" },
  { href: "/qfinera/about", label: "About" },
];

export default function QFinanceFooter() {
  return (
    <footer className="border-t border-[var(--qf-line)] px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-[13px] text-[var(--qf-ink-soft)]">
          © {new Date().getFullYear()} {qfinanceConfig.name}, by QCyberIndia. Not investment advice.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-end">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-[13px] text-[var(--qf-ink-soft)] hover:text-[var(--qf-brass-dark)]">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
