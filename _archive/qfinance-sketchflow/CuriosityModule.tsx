"use client";

import { useEffect, useState, ReactNode } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import SketchCanvas from "./SketchCanvas";

export type CuriosityChoice = string;

export default function CuriosityModule({
  eyebrow,
  question,
  hook,
  choices,
  correctIndex,
  scene,
  sceneLabel,
  viewBox = "0 0 640 340",
  mobileViewBox,
  mobileBreakpoint = 480,
  textEquivalent,
  concept,
  explanation,
  nextCuriosity,
  onAnswered,
  gateRevealOnSceneComplete = false,
  observationPauseMs = 700,
}: {
  eyebrow: string;
  question: string;
  hook: string;
  choices: CuriosityChoice[];
  correctIndex: number;
  scene: (opts: { play: boolean; reduceMotion: boolean; isMobile: boolean; onComplete: () => void }) => {
    sketch: ReactNode;
    crisp: ReactNode;
  };
  sceneLabel: string;
  /** Desktop SVG viewBox. Unchanged default preserves current C2\u2013C7 behavior. */
  viewBox?: string;
  /**
   * Optional narrower/taller viewBox used below `mobileBreakpoint`. Purely
   * generic - any curiosity scene can opt in; CuriosityModule has no idea
   * what a scene does with it beyond picking which viewBox string to render.
   */
  mobileViewBox?: string;
  mobileBreakpoint?: number;
  textEquivalent: ReactNode;
  concept: ReactNode;
  explanation: ReactNode;
  nextCuriosity: { prompt: string; cta: string; href: string };
  onAnswered?: (wasCorrect: boolean) => void;
  /**
   * When true, the reveal (concept/explanation/next-curiosity block) waits
   * for the scene to call its `onComplete` callback, then an additional
   * `observationPauseMs`, before appearing. When false (default), reveal
   * behavior is unchanged from before this option existed - it appears
   * immediately alongside the animation. This keeps C2\u2013C7 compatible
   * without any scene-specific logic living in this generic component.
   */
  gateRevealOnSceneComplete?: boolean;
  observationPauseMs?: number;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [playToken, setPlayToken] = useState(0);
  const [revealed, setRevealed] = useState(!gateRevealOnSceneComplete);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`);
    setIsMobile(mq.matches);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mobileBreakpoint]);

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    setPlayToken((t) => t + 1);
    setRevealed(!gateRevealOnSceneComplete);
    onAnswered?.(i === correctIndex);
  }

  function handleSceneComplete() {
    if (!gateRevealOnSceneComplete) return;
    window.setTimeout(() => setRevealed(true), observationPauseMs);
  }

  const effectiveViewBox = isMobile && mobileViewBox ? mobileViewBox : viewBox;

  return (
    <div className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 sm:p-8">
      <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--qf-brass-dark)]">
        Curiosity · {eyebrow}
      </p>
      <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[28px]">
        &ldquo;{question}&rdquo;
      </h3>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--qf-ink-soft)]">{hook}</p>

      {picked === null ? (
        <div className="mt-6 flex flex-wrap gap-2.5" role="group" aria-label="Make your guess">
          {choices.map((c, i) => (
            <button
              key={c}
              type="button"
              onClick={() => pick(i)}
              className="rounded-full border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-4 py-2 text-sm text-[var(--qf-ink)] transition-colors hover:border-[var(--qf-brass)] hover:text-[var(--qf-brass-dark)]"
            >
              {c}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* the picked/correct choices, now locked */}
          <div className="flex flex-wrap gap-2.5" role="group" aria-label="Your guess">
            {choices.map((c, i) => {
              const isCorrect = i === correctIndex;
              const isPicked = i === picked;
              return (
                <span
                  key={c}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm ${
                    isCorrect
                      ? "border-[var(--qf-up)] bg-[var(--qf-up)]/10 text-[var(--qf-up)]"
                      : isPicked
                      ? "border-[var(--qf-down)] bg-[var(--qf-down)]/10 text-[var(--qf-down)]"
                      : "border-[var(--qf-line)] text-[var(--qf-ink-soft)] opacity-60"
                  }`}
                >
                  {isCorrect && <Check size={13} />}
                  {isPicked && !isCorrect && <X size={13} />}
                  {c}
                </span>
              );
            })}
          </div>

          <SketchCanvas viewBox={effectiveViewBox} label={sceneLabel} textEquivalent={textEquivalent} playToken={playToken}>
            {(opts) => scene({ ...opts, isMobile, onComplete: handleSceneComplete })}
          </SketchCanvas>

          {revealed && (
            <>
              <div className="border-t border-dashed border-[var(--qf-line)] pt-5">
                <p className="font-display text-sm font-semibold text-[var(--qf-ink)]">
                  {picked === correctIndex ? "Exactly right." : "Good guess — here's what actually happens:"}
                </p>
                <div className="mt-2 text-[15px] leading-relaxed text-[var(--qf-ink)]">{concept}</div>
              </div>

              <div className="text-[14px] leading-relaxed text-[var(--qf-ink-soft)]">{explanation}</div>

              <div className="rounded-sm border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/[0.06] p-4">
                <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--qf-brass-dark)]">
                  Now you&apos;re probably wondering
                </p>
                <p className="mt-1.5 font-display text-[15px] font-medium text-[var(--qf-ink)]">
                  &ldquo;{nextCuriosity.prompt}&rdquo;
                </p>
                <a
                  href={nextCuriosity.href}
                  className="mt-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline"
                >
                  {nextCuriosity.cta}
                  <ArrowRight size={14} />
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
