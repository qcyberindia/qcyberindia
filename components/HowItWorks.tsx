"use client";

import { Search, ClipboardList, Rocket, Activity, TrendingUp } from "lucide-react";
import { processSteps } from "@/lib/site-config";
import Reveal from "@/components/Reveal";

const icons = [Search, ClipboardList, Rocket, Activity, TrendingUp];

export default function HowItWorks() {
  return (
    <section className="section-tight border-t border-[var(--color-line)]">
      <p className="eyebrow mb-4">How it works</p>
      <h2 className="font-display text-2xl md:text-3xl font-extrabold text-[var(--color-navy)] max-w-xl">
        What actually happens after you contact us
      </h2>

      {/* Desktop: horizontal timeline */}
      <div className="mt-14 hidden md:block">
        <div className="relative grid grid-cols-5 gap-4">
          <div className="absolute left-0 right-0 top-6 h-px bg-[var(--color-line)]" aria-hidden="true" />
          {processSteps.map((s, i) => {
            const Icon = icons[i] ?? Activity;
            return (
              <Reveal key={s.step} delay={i * 100}>
                <div className="group relative pr-4">
                  <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-navy)] transition-all duration-300 group-hover:border-[var(--color-red)] group-hover:bg-[var(--color-red)] group-hover:text-white">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 font-display font-bold text-[var(--color-navy)]">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-[var(--color-fog)] leading-relaxed">{s.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      {/* Mobile: vertical timeline */}
      <div className="mt-10 md:hidden space-y-8 relative">
        <div className="absolute left-6 top-2 bottom-2 w-px bg-[var(--color-line)]" aria-hidden="true" />
        {processSteps.map((s, i) => {
          const Icon = icons[i] ?? Activity;
          return (
            <Reveal key={s.step} delay={i * 80}>
              <div className="relative flex gap-4">
                <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-navy)]">
                  <Icon size={20} />
                </div>
                <div className="pt-1.5">
                  <h3 className="font-display font-bold text-[var(--color-navy)]">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-[var(--color-fog)] leading-relaxed">{s.description}</p>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
