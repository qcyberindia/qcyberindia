"use client";

import { useState, ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Progressive disclosure (Section 32) — "Learn more →" / "Why does this
 * matter?" style expandable. Keeps the default screen visually light while
 * still letting a curious reader go one level deeper without navigating away.
 */
export default function ConceptReveal({
  prompt = "Learn more",
  children,
}: {
  prompt?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)]"
      >
        {prompt}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 border-l-2 border-[var(--qf-line)] pl-4 text-[14.5px] leading-relaxed text-[var(--qf-ink-soft)]">
          {children}
        </div>
      )}
    </div>
  );
}
