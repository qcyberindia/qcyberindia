"use client";

import { useEffect, useState, ReactNode } from "react";
import { Play, RotateCcw, Type } from "lucide-react";

/**
 * Shared frame for every SketchFlow scene: hand-drawn SVG filter defs,
 * play/replay controls, prefers-reduced-motion handling, and a
 * "read the explanation instead" text-equivalent toggle (Section 30/29
 * of the QFinance spec — no information conveyed through animation alone).
 *
 * Two-layer rendering model (readability fix, see C1 visual-correction pass):
 * a scene returns `{ crisp, sketch }` instead of a single flat tree.
 * `sketch` (arrows, connecting paths, decorative strokes) gets the
 * hand-drawn feTurbulence/feDisplacementMap filter. `crisp` (node boxes,
 * all text/labels, the MATCHED stamp, MovingDot) renders with zero filter,
 * on top of the sketch layer, so information never gets warped — only the
 * illustrative strokes do.
 */
export default function SketchCanvas({
  viewBox = "0 0 640 360",
  children,
  textEquivalent,
  onPlay,
  playToken,
  label,
}: {
  viewBox?: string;
  children: (opts: { play: boolean; reduceMotion: boolean }) => {
    /** Arrows, connecting paths, decorative strokes — gets the hand-drawn filter. */
    sketch: ReactNode;
    /** Node boxes, text, labels, stamps, MovingDot — never filtered. */
    crisp: ReactNode;
  };
  textEquivalent: ReactNode;
  onPlay?: () => void;
  playToken: number; // bump to replay
  label: string;
}) {
  const [play, setPlay] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (playToken > 0) setPlay(true);
  }, [playToken]);

  function handlePlay() {
    if (play) {
      // Replay: `setPlay(true)` while `play` is already `true` is a no-op —
      // React bails out on an unchanged state value, so nothing below would
      // ever re-render, let alone re-run any CSS transition. Cycle through
      // `false` first so every child (DrawPath, MovingDot, Node, MatchedStamp,
      // PathLabel — all now wired to snap instantly to their reset state
      // when their visibility prop goes false) genuinely returns to its
      // starting state. The double rAF guarantees the browser actually
      // paints that reset frame before flipping back to `true`; a single
      // setTimeout(0) or an immediate second setState can otherwise get
      // coalesced into the same commit, in which case the CSS transition
      // has no prior painted state to animate from and just jumps to the
      // end value with no visible motion.
      setPlay(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPlay(true);
          onPlay?.();
        });
      });
    } else {
      setPlay(true);
      onPlay?.();
    }
  }

  const { sketch, crisp } = children({ play, reduceMotion });

  return (
    <div className="rounded-sm border border-[var(--qf-line)] bg-[var(--qf-cream-0)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--qf-line)] px-4 py-2.5">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--qf-ink-soft)]">
          {label}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowText((v) => !v)}
            aria-pressed={showText}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--qf-line)] px-2.5 py-1 text-[11px] font-medium text-[var(--qf-ink-soft)] transition-colors hover:border-[var(--qf-brass)] hover:text-[var(--qf-brass-dark)]"
          >
            <Type size={12} />
            {showText ? "Watch the sketch" : "Read instead"}
          </button>
          {play && !reduceMotion && (
            <button
              type="button"
              onClick={handlePlay}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--qf-line)] px-2.5 py-1 text-[11px] font-medium text-[var(--qf-ink-soft)] transition-colors hover:border-[var(--qf-brass)] hover:text-[var(--qf-brass-dark)]"
            >
              <RotateCcw size={12} />
              Replay
            </button>
          )}
        </div>
      </div>

      <div className="relative p-4 sm:p-6">
        {showText ? (
          <div className="min-h-[220px] font-body text-[15px] leading-relaxed text-[var(--qf-ink)]">
            {textEquivalent}
          </div>
        ) : (
          <>
            <svg
              viewBox={viewBox}
              className="qf-sketch h-auto w-full text-[var(--qf-ink)]"
              role="img"
              aria-label={label}
            >
              <defs>
                {/*
                  Deliberately mild: this used to wrap the ENTIRE scene
                  (text included) with scale=3.2, which warped labels into
                  illegibility on a small viewBox. Now it only ever touches
                  the `sketch` layer (thin arrow strokes), so a much gentler
                  wobble reads as "drawn by hand" rather than "corrupted SVG."
                */}
                <filter id="qf-hand-drawn" x="-15%" y="-15%" width="130%" height="130%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.018 0.045" numOctaves="2" seed="7" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
                </filter>
              </defs>

              {/* Sketch layer first (background) — arrows/paths only, never text. */}
              <g filter="url(#qf-hand-drawn)">{sketch}</g>

              {/* Crisp layer on top — node boxes, labels, stamps, MovingDot. */}
              <g>{crisp}</g>
            </svg>

            {!play && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handlePlay}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--qf-ink)] px-5 py-2.5 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-85"
                >
                  <Play size={14} />
                  See it happen
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
