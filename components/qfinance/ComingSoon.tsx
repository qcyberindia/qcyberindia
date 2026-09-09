import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import Reveal from "@/components/Reveal";

/**
 * Shared placeholder for QFinance routes whose information architecture is
 * confirmed (Phase 1) but whose full content hasn't been built yet. Keeps
 * every real link in the product live instead of 404ing, without faking
 * content that doesn't exist.
 */
export default function ComingSoon({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div>
      <QFinanceHeader />
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-lg text-center">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">{eyebrow}</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--qf-ink)] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">{description}</p>
            <Link
              href={backHref}
              className="mt-8 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline"
            >
              <ArrowLeft size={14} />
              {backLabel}
            </Link>
          </Reveal>
        </div>
      </section>
      <QFinanceFooter />
    </div>
  );
}
