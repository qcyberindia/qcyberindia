import Link from "next/link";
import { ArrowRight } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import ScrollToJourney from "@/components/qfinance/learning/ScrollToJourney";
import Reveal from "@/components/Reveal";
import { qfinanceConfig } from "@/lib/qfinance-config";

const loopSteps = [
  {
    word: "Discuss",
    body: "Talk through an idea before you commit to it — with other investors thinking as carefully as you are.",
  },
  {
    word: "Record",
    body: "Write down what you decided and why, at the moment you decided it — not a reconstructed memory of it later.",
  },
  {
    word: "Research",
    body: "Turn scattered notes and conversations into an actual thesis you can revisit and test.",
  },
  {
    word: "Refine",
    body: "Come back when something changes. Update what you believe. Keep the thinking, not just the outcome.",
  },
];

export default function QFineraHomePage() {
  return (
    <div>
      <QFinanceHeader />

      {/* Hero */}
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--qf-brass-dark)]">
              <span className="h-px w-7 bg-[var(--qf-brass)]" />
              {qfinanceConfig.name}
            </p>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--qf-ink)] sm:text-5xl">
              A New.{" "}
              <em className="font-light italic text-[var(--qf-brass-dark)]">
                Financial.
              </em>{" "}
              Era.
            </h1>
          </Reveal>

          <Reveal delay={140}>
            <p className="mx-auto mt-6 max-w-md text-[17px] leading-relaxed text-[var(--qf-ink-soft)]">
              A private room for investors to discuss, record, research, and
              manage their own investment thinking.
            </p>
          </Reveal>

          <Reveal delay={200}>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/qfinera/community"
                className="inline-flex items-center gap-2 rounded-sm bg-[var(--qf-brass)] px-6 py-3 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90"
              >
                Explore QFinera
                <ArrowRight size={15} />
              </Link>
            </div>
          </Reveal>
        </div>

        <ScrollToJourney targetId="how-it-works" label="See how it works" />
      </section>

      {/* The investor's thinking loop */}
      <div
        id="how-it-works"
        className="scroll-mt-6 border-t border-[var(--qf-line)] bg-[var(--qf-cream-1)]"
      >
        <div className="mx-auto max-w-2xl px-6 py-20 sm:py-28">
          <Reveal>
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              How it works
            </p>

            <h2 className="mx-auto mt-3 max-w-lg text-center font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[32px]">
              Strong investing isn&apos;t only about finding information.
            </h2>

            <p className="mx-auto mt-4 max-w-md text-center text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              It&apos;s about building, testing, recording, and improving your
              own thinking — on purpose, over time.
            </p>
          </Reveal>

          <div className="mt-14 space-y-0">
            {loopSteps.map((step, i) => (
              <Reveal key={step.word} delay={i * 90}>
                <div className="flex gap-6 border-t border-[var(--qf-line)] py-7 first:border-t-0 sm:gap-10">
                  <p className="w-8 shrink-0 pt-0.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)]">
                    {String(i + 1).padStart(2, "0")}
                  </p>

                  <div>
                    <p className="font-display text-xl font-semibold text-[var(--qf-ink)] sm:text-[22px]">
                      {step.word}
                    </p>

                    <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-[var(--qf-ink-soft)]">
                      {step.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* Community — the first living part of QFinera */}
      <section className="border-t border-[var(--qf-line)] bg-[var(--qf-cream-1)] px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-xl text-center">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-up)]">
              Live today
            </p>

            <h2 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[32px]">
              The Community is where {qfinanceConfig.name} actually begins.
            </h2>

            <p className="mx-auto mt-4 max-w-md text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              Before the rest of the workspace exists, the conversation
              already does. Ask a question, read what other beginners are
              working through, and see how other investors are thinking right
              now.
            </p>

            <Link
              href="/qfinera/community"
              className="mt-7 inline-flex items-center gap-2 font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline"
            >
              Explore Community
              <ArrowRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Why QFinera — philosophy, not a features recap */}
      <section className="border-t border-[var(--qf-line)] px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-xl text-center">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">
              Why {qfinanceConfig.name}
            </p>

            <h2 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[32px]">
              Investing creates information everywhere.
            </h2>

            <p className="mx-auto mt-4 max-w-md text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              A tip here, a screenshot there, a conviction you had six months
              ago that you can no longer quite reconstruct.{" "}
              {qfinanceConfig.name} is meant to be the place your own thinking
              actually lives — owned by you, continuous, worth returning to.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t border-[var(--qf-line)] px-6 py-24 sm:py-28">
        <div className="mx-auto max-w-lg text-center">
          <Reveal>
            <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[32px]">
              Your investment thinking deserves a place of its own.
            </h2>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/qfinera/community"
                className="inline-flex items-center gap-2 rounded-sm bg-[var(--qf-brass)] px-6 py-3 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90"
              >
                Explore QFinera
                <ArrowRight size={15} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <QFinanceFooter />
    </div>
  );
}