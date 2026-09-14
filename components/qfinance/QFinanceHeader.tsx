import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function QFinanceHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--qf-line)] bg-[var(--qf-cream-0)]/95 backdrop-blur">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 sm:py-[18px]">
        <Link
          href="/qfinera"
          className="font-display text-xl font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[22px]"
          aria-label="QFinera home"
        >
          Q<em className="not-italic text-[var(--qf-brass)]">Finera</em>
        </Link>

        <div className="flex items-center gap-4 sm:gap-5">
          <Link
            href="/qfinera/learn/beginner"
            className="hidden text-sm font-medium text-[var(--qf-ink-soft)] transition-colors hover:text-[var(--qf-brass-dark)] sm:inline"
          >
            Learn
          </Link>

          <Link
            href="/qfinera/community"
            className="hidden text-sm font-medium text-[var(--qf-ink-soft)] transition-colors hover:text-[var(--qf-brass-dark)] sm:inline"
          >
            Community
          </Link>

          <Link
            href="/qfinera/why-india-investing"
            className="hidden text-sm font-medium text-[var(--qf-ink-soft)] transition-colors hover:text-[var(--qf-brass-dark)] sm:inline"
          >
            Why India
          </Link>


          <ThemeToggle />

          <Link
            href="/qfinera/beta"
            className="rounded-sm bg-[var(--qf-brass)] px-4 py-2.5 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90"
          >
            Join the Beta
          </Link>
        </div>
      </nav>
    </header>
  );
}