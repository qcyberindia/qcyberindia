import {
  Activity,
  ShieldCheck,
  Server,
  TrendingUp,
  Check,
} from "lucide-react";

import { outcomePillars } from "@/lib/site-config";

const icons = {
  operations: Activity,
  security: ShieldCheck,
  infrastructure: Server,
  growth: TrendingUp,
};

export default function OutcomePillars() {
  return (
    <section className="grid gap-5 md:grid-cols-2 items-stretch">
      {outcomePillars.map((pillar) => {
        const Icon =
          icons[pillar.id as keyof typeof icons] ?? Activity;

        return (
          <article
            key={pillar.id}
            className="group h-full rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-red)] hover:shadow-lg"
          >
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-paper-2)]">
                <Icon
                  size={22}
                  className="text-[var(--color-navy)] transition-all duration-300 group-hover:scale-110"
                />
              </div>

              <div className="flex-1">
                <h3 className="font-display text-xl font-bold leading-tight text-[var(--color-navy)]">
                  {pillar.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-[var(--color-fog)]">
                  {pillar.promise}
                </p>
              </div>
            </div>

            {/* Features */}
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {pillar.includes.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-xl bg-[var(--color-paper-2)] px-3 py-2 transition-colors duration-300 group-hover:bg-white"
                >
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-gold)]/20">
                    <Check
                      size={12}
                      className="text-[var(--color-gold)]"
                    />
                  </div>

                  <span className="text-[13px] font-medium leading-5 text-[var(--color-navy)]">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </section>
  );
}