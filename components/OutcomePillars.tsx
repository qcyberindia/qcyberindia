import {
  Activity,
  ShieldCheck,
  Server,
  TrendingUp,
  Check,
} from "lucide-react";

import { outcomePillars } from "@/lib/site-config";
import Reveal from "@/components/Reveal";

const icons = {
  operations: Activity,
  security: ShieldCheck,
  infrastructure: Server,
  growth: TrendingUp,
};

// Distinct accent per pillar so the grid reads as four different
// capabilities at a glance, not four repeats of the same card.
const accents = {
  operations: { bar: "bg-[var(--color-navy)]", iconBg: "bg-[var(--color-navy)]/10", icon: "text-[var(--color-navy)]", ring: "hover:border-[var(--color-navy)]" },
  security: { bar: "bg-[var(--color-red)]", iconBg: "bg-[var(--color-red)]/10", icon: "text-[var(--color-red)]", ring: "hover:border-[var(--color-red)]" },
  infrastructure: { bar: "bg-[var(--color-gold)]", iconBg: "bg-[var(--color-gold)]/15", icon: "text-[#a06e00]", ring: "hover:border-[var(--color-gold)]" },
  growth: { bar: "bg-[var(--color-navy)]", iconBg: "bg-[var(--color-navy)]/10", icon: "text-[var(--color-navy)]", ring: "hover:border-[var(--color-navy)]" },
};

export default function OutcomePillars() {
  return (
    <section className="grid gap-5 md:grid-cols-2 items-stretch">
      {outcomePillars.map((pillar, i) => {
        const Icon = icons[pillar.id as keyof typeof icons] ?? Activity;
        const accent = accents[pillar.id as keyof typeof accents] ?? accents.operations;

        return (
          <Reveal key={pillar.id} delay={i * 90} className="h-full">
            <article
              className={`group relative h-full overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white p-6 pt-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${accent.ring}`}
            >
              {/* Top accent bar */}
              <span className={`absolute inset-x-0 top-0 h-1 ${accent.bar}`} aria-hidden="true" />

              {/* Header */}
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accent.iconBg}`}>
                  <Icon size={22} className={`${accent.icon} transition-transform duration-300 group-hover:scale-110`} />
                </div>

                <div className="flex-1">
                  <h3 className="font-display text-xl font-extrabold leading-tight text-[var(--color-navy)]">
                    {pillar.title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-[var(--color-fog)]">
                    {pillar.promise}
                  </p>
                </div>
              </div>

              {/* Features */}
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {pillar.includes.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2.5 rounded-lg bg-[var(--color-paper-2)] px-3 py-2 transition-colors duration-300 group-hover:bg-[var(--color-paper)]"
                  >
                    <Check size={13} className={`shrink-0 ${accent.icon}`} />
                    <span className="text-[13px] font-medium leading-5 text-[var(--color-navy)]">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        );
      })}
    </section>
  );
}
