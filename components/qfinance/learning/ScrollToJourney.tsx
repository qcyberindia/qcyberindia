"use client";

import { useEffect, useState } from "react";

export default function ScrollToJourney() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY < 120);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToJourney = () => {
    document.getElementById("journey")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToJourney}
      aria-label="Scroll down to begin the Beginner Journey"
      className="group absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-xs font-medium text-[var(--qf-ink-soft)] transition-colors duration-200 hover:text-[var(--qf-brass-dark)]"
    >
      <span>Scroll to begin</span>

      <span
        aria-hidden="true"
        className="text-base leading-none transition-transform duration-200 group-hover:translate-y-0.5"
      >
        ↓
      </span>
    </button>
  );
}