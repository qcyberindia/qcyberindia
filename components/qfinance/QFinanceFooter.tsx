import Link from "next/link";
import { qfinanceConfig } from "@/lib/qfinance-config";

export default function QFinanceFooter() {
  return (
    <footer className="border-t border-[var(--qf-line)] px-6 py-10">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-[13px] text-[var(--qf-ink-soft)]">
          © {new Date().getFullYear()} {qfinanceConfig.name}, by QCyberIndia
        </p>
        <div className="flex items-center gap-5">
          <Link href="/qfinera/learn/beginner" className="text-[13px] text-[var(--qf-ink-soft)] hover:text-[var(--qf-brass-dark)]">
            Learn
          </Link>
          <Link href="/qfinera/community" className="text-[13px] text-[var(--qf-ink-soft)] hover:text-[var(--qf-brass-dark)]">
            Community
          </Link>
          <Link href="/qfinera/about" className="text-[13px] text-[var(--qf-ink-soft)] hover:text-[var(--qf-brass-dark)]">
            About
          </Link>
        </div>
      </div>
      <p className="mx-auto mt-4 max-w-md text-center text-[12.5px] leading-relaxed text-[var(--qf-ink-soft)] sm:text-left">
        
      </p>
    </footer>
  );
}
