"use client";

import { useEffect, useState } from "react";

type ScrollToJourneyProps = {
  targetId: string;
  label?: string;
};

export default function ScrollToJourney({
  targetId,
  label = "Continue below",
}: ScrollToJourneyProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY < 100);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTarget = () => {
    document.getElementById(targetId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (!visible) return null;

  return (
    <div className="mt-8 flex justify-center">
      <button
        type="button"
        onClick={scrollToTarget}
        aria-label={`${label}. Continue down the page.`}
        className="group flex flex-col items-center gap-2 text-[var(--qf-ink-soft)] transition-colors duration-300 hover:text-[var(--qf-brass-dark)]"
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--qf-line)] transition-all duration-300 group-hover:border-[var(--qf-brass-dark)] group-hover:bg-[var(--qf-surface)]"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4 animate-[qf-scroll-arrow_2s_ease-in-out_infinite]"
          >
            <path
              d="M5 7.5L10 12.5L15 7.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <span className="text-[10px] font-medium uppercase tracking-[0.16em]">
          {label}
        </span>
      </button>
    </div>
  );
}
