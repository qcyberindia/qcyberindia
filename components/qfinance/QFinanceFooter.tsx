import Link from "next/link";
import { qfinanceConfig } from "@/lib/qfinance-config";

const GROUPS = [
  {
    title: "Product",
    links: [
      { href: "/qfinera/learn", label: "Learn" },
      { href: "/qfinera/research", label: "Research" },
      { href: "/qfinera/watch", label: "Global Watch" },
      { href: "/qfinera/community", label: "Community" },
      { href: "/qfinera/pools", label: "Pools" },
    ],
  },
  {
    title: "Guides",
    links: [
      { href: "/qfinera/learn/beginner", label: "Beginner journey" },
      { href: "/qfinera/learn/pool-guide", label: "Pool Guide" },
      { href: "/qfinera/why-india-investing", label: "Why India is investing" },
    ],
  },
  {
    title: "QFinera",
    links: [
      { href: "/qfinera/about", label: "About" },
      { href: "/qfinera/roadmap", label: "What's next" },
      { href: "/qfinera/register", label: "Join QFinera" },
    ],
  },
];

export default function QFinanceFooter() {
  return (
    <footer className="border-t border-[var(--qf-line)] px-4 py-10 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div>
          <Link href="/qfinera" className="font-display text-[20px] font-semibold tracking-tight text-[var(--qf-ink)]">
            Q<em className="not-italic text-[var(--qf-brass)]">Finera</em>
          </Link>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-[var(--qf-ink-soft)]">Research. Learn. Share. Manage. Built in India by QCyberIndia.</p>
        </div>
        {GROUPS.map((g) => (
          <nav key={g.title} aria-label={g.title}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--qf-ink-soft)]">{g.title}</p>
            <ul className="mt-3 space-y-2">
              {g.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-[13.5px] text-[var(--qf-ink)] hover:text-[var(--qf-brass-dark)]">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto mt-10 max-w-6xl border-t border-[var(--qf-line)]/70 pt-5 text-[12.5px] text-[var(--qf-ink-soft)]">
        © {new Date().getFullYear()} {qfinanceConfig.name}, by QCyberIndia. Educational and record-keeping software. Not investment advice.
      </p>
    </footer>
  );
}
