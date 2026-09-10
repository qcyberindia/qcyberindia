"use client";

import { useEffect, useState } from "react";

type ScrollToJourneyProps = {
  targetId: string;
  label?: string;
};

export default function ScrollToJourney({
  targetId,
  label = "Scroll to begin",
}: ScrollToJourneyProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY < 120);
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
    <button
      type="button"
      onClick={scrollToTarget}
      aria-label={`${label}. Continue down the page.`}
      className="group absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center text-[var(--qf-ink-soft)] transition-all duration-300 hover:text-[var(--qf-brass-dark)]"
    >
      <span className="mb-2 text-[11px] font-medium uppercase tracking-[0.12em]">
        {label}
      </span>

      <span
        aria-hidden="true"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--qf-line)] transition-all duration-300 group-hover:scale-105 group-hover:border-[var(--qf-brass-dark)]"
      >
        <span className="absolute -top-3 h-3 w-px bg-[var(--qf-line)] transition-colors duration-300 group-hover:bg-[var(--qf-brass-dark)]" />

        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4 animate-[qf-scroll-arrow_1.8s_ease-in-out_infinite]"
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
    </button>
  );
}
