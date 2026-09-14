"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";

function getRoot() {
  return typeof document === "undefined" ? null : document.getElementById("qf-root");
}

// The blocking init script in app/qfinera/layout.tsx is the single source
// of truth for the resolved theme (localStorage["qf-theme"], falling back to
// system preference) — it sets #qf-root[data-qf-theme] before first paint.
// ThemeToggle doesn't run a second initialization; it just reads that
// attribute via useSyncExternalStore, which is the React-sanctioned way to
// read externally-owned state (here: the DOM) without a set-state-in-effect
// and without a hydration mismatch — its whole purpose is reconciling a
// client-only snapshot against a server snapshot safely.
function subscribe(callback: () => void) {
  const root = getRoot();
  if (!root) return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(root, { attributes: true, attributeFilter: ["data-qf-theme"] });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return getRoot()?.getAttribute("data-qf-theme") === "dark" ? "dark" : "light";
}

// Server can't know the visitor's saved/system preference; the client
// resolves the real value pre-paint (see layout.tsx), and
// useSyncExternalStore reconciles this component to it immediately after
// hydration - no visible flip, no FOUC.
function getServerSnapshot(): Theme {
  return "light";
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === "dark";

  function toggle() {
    const next: Theme = isDark ? "light" : "dark";
    getRoot()?.setAttribute("data-qf-theme", next);
    try {
      localStorage.setItem("qf-theme", next);
    } catch {
      // localStorage unavailable — theme just won't persist across visits.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      aria-pressed={isDark}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--qf-line)] text-[var(--qf-ink-soft)] transition-colors hover:border-[var(--qf-brass)] hover:text-[var(--qf-brass-dark)]"
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
