"use client";

import { useEffect, useState, CSSProperties } from "react";

/**
 * A small dot that travels along an existing SVG path — the visual
 * representation of "an order moving through the system". Deliberately
 * reuses DrawPath's timing convention (delay/duration + setTimeout-based
 * onDone) rather than introducing a second animation paradigm, and reuses
 * the CSS-transition approach (this time animating `offset-distance` along
 * `offset-path` instead of `stroke-dashoffset`) so no animation library is
 * introduced.
 *
 * Reduced motion: the dot is a movement *cue*, not new information — the
 * connecting line (drawn by DrawPath) already communicates the relationship
 * instantly. So under prefers-reduced-motion, MovingDot renders nothing at
 * all rather than trying to animate.
 *
 * Replay fix: `phase` now explicitly resets to "idle" whenever `play` goes
 * false (not just "skip scheduling new timers", which is all the previous
 * version did). Without this, a second play cycle left `offsetDistance`
 * stuck at "100%" from the previous run — the dot would just pop into view
 * already at the end of the path instead of visibly traveling again.
 * `transition` is also now conditional on `play`: while resetting, it's
 * "none" so the snap-back to the start position is instant and invisible,
 * rather than animating backwards along the path before the next play even
 * begins.
 */
export default function MovingDot({
  d,
  play,
  delay = 0,
  duration = 550,
  radius = 4.5,
  reduceMotion = false,
  className = "",
  onDone,
}: {
  d: string;
  play: boolean;
  delay?: number;
  duration?: number;
  radius?: number;
  reduceMotion?: boolean;
  className?: string;
  onDone?: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "moving" | "done">("idle");

  useEffect(() => {
    if (!play || reduceMotion) {
      setPhase("idle");
      return;
    }
    const start = setTimeout(() => setPhase("moving"), delay);
    const finish = setTimeout(() => {
      setPhase("done");
      onDone?.();
    }, delay + duration);
    return () => {
      clearTimeout(start);
      clearTimeout(finish);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduceMotion]);

  if (reduceMotion) return null;

  const traveling = phase !== "idle";

  const style: CSSProperties = {
    offsetPath: `path('${d}')`,
    offsetRotate: "0deg",
    offsetDistance: traveling ? "100%" : "0%",
    opacity: phase === "moving" ? 1 : 0,
    transition: play
      ? `offset-distance ${duration}ms cubic-bezier(.4,0,.2,1), opacity 200ms ease`
      : "none",
  } as CSSProperties;

  return <circle r={radius} fill="var(--qf-brass-dark)" className={className} style={style} />;
}
