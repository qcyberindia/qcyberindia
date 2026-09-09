"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A single SVG path that "draws itself" — the core primitive of SketchFlow.
 * Length is measured at runtime (getTotalLength) so any path shape works
 * without hand-tuning dash values. Respects prefers-reduced-motion by
 * rendering fully drawn immediately.
 *
 * Replay fix: `transition` is now conditional on `play`. Previously it was
 * always the same delayed transition string regardless of direction, so
 * resetting (`play` true → false, ahead of a replay) would slowly "un-draw"
 * the line over `delay + duration` ms — up to ~2.8s for the slowest path in
 * BuyScene — before the next play cycle even started. If the next play
 * arrived before that finished, the path could still be mid-transition and
 * simply stay fully drawn, silently skipping the redraw animation entirely.
 * Now resetting snaps instantly (`transition: "none"`) so every replay
 * starts from a genuinely undrawn state.
 */
export default function DrawPath({
  d,
  play,
  delay = 0,
  duration = 700,
  className = "",
  fill = "none",
  strokeWidth = 2.5,
  reduceMotion = false,
  onDone,
}: {
  d: string;
  play: boolean;
  delay?: number;
  duration?: number;
  className?: string;
  fill?: string;
  strokeWidth?: number;
  reduceMotion?: boolean;
  onDone?: () => void;
}) {
  const ref = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (ref.current) setLength(ref.current.getTotalLength());
  }, [d]);

  useEffect(() => {
    if (!play || reduceMotion) return;
    const t = setTimeout(() => onDone?.(), delay + duration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduceMotion]);

  const drawn = reduceMotion || play;

  return (
    <path
      ref={ref}
      d={d}
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{
        strokeDasharray: length,
        strokeDashoffset: drawn ? 0 : length,
        transition:
          reduceMotion || !play
            ? "none"
            : `stroke-dashoffset ${duration}ms cubic-bezier(.4,0,.2,1) ${delay}ms`,
      }}
    />
  );
}
