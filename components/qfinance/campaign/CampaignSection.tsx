import { ReactNode } from "react";
import Reveal from "@/components/Reveal";

/**
 * One "moment" of the campaign — reused for all nine sections instead of
 * one-off JSX per moment. Alternates a subtle background tint for rhythm;
 * no scroll-hijacking, no animation library — just the existing
 * IntersectionObserver-driven Reveal, same as the rest of QFinance.
 */
export default function CampaignSection({
  moment,
  eyebrow,
  headline,
  children,
  visual,
  tone = "default",
}: {
  moment?: string;
  eyebrow?: string;
  headline: ReactNode;
  children?: ReactNode;
  visual?: ReactNode;
  tone?: "default" | "tinted";
}) {
  return (
    <section className={tone === "tinted" ? "bg-[var(--qf-cream-1)]" : ""}>
      <div className="mx-auto max-w-xl px-6 py-16 sm:py-24">
        <Reveal>
          {(moment || eyebrow) && (
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">
              {moment && <span>{moment}</span>}
              {moment && eyebrow && <span> · </span>}
              {eyebrow}
            </p>
          )}
          <h2 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[32px]">
            {headline}
          </h2>
          {visual && <div className="mt-7">{visual}</div>}
          {children && (
            <div className="mt-5 space-y-3 text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              {children}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
