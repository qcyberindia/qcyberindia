import { ReactNode } from "react";
import Reveal from "@/components/Reveal";

/**
 * One concept per screen (Section 20/32). Every chapter is built from a
 * sequence of these — an optional eyebrow, an optional question headline,
 * and a body. Deliberately plain: no animation beyond the existing
 * IntersectionObserver-driven Reveal, no diagrams unless the caller passes
 * one in as `visual`.
 */
export default function LearningSection({
  eyebrow,
  question,
  visual,
  children,
  tight = false,
}: {
  eyebrow?: string;
  question?: string;
  visual?: ReactNode;
  children?: ReactNode;
  tight?: boolean;
}) {
  return (
    <section className={tight ? "py-10 sm:py-14" : "py-14 sm:py-20"}>
      <div className="mx-auto max-w-xl px-6">
        <Reveal>
          {eyebrow && (
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--qf-brass-dark)]">
              {eyebrow}
            </p>
          )}
          {question && (
            <h2 className="mt-2.5 font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[28px]">
              {question}
            </h2>
          )}
          {visual && <div className="mt-6">{visual}</div>}
          {children && (
            <div className="mt-4 space-y-3 text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              {children}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
