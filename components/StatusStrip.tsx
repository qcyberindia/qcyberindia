import {
  Network,
  Headphones,
  Receipt,
  Users,
} from "lucide-react";

import { statusMetrics } from "@/lib/site-config";

const icons = {
  Technology: Network,
  Support: Headphones,
  Pricing: Receipt,
  Accountability: Users,
};

export default function StatusStrip() {
  return (
    <section className="w-full">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {statusMetrics.map((m) => {
          const Icon = icons[m.label as keyof typeof icons];

          return (
            <div
              key={m.label}
              className="group rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-red)] hover:shadow-xl"
            >
              {/* Icon */}
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[color:color-mix(in_srgb,var(--color-navy)_10%,white)]">
                <Icon
                  size={28}
                  className="text-[var(--color-navy)] transition-all duration-300 group-hover:scale-110 group-hover:text-[var(--color-red)]"
                />
              </div>

              {/* Label */}
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-fog)]">
                {m.label}
              </p>

              {/* Title */}
              <h3 className="mt-2 text-2xl font-bold leading-tight text-[var(--color-navy)] transition-colors duration-300 group-hover:text-[var(--color-red)]">
                {m.value}
              </h3>

              {/* Gold Accent */}
              <div className="mt-4 h-1 w-12 rounded-full bg-[var(--color-gold)] transition-all duration-300 group-hover:w-20" />

              {/* Description */}
              <p className="mt-5 text-sm leading-7 text-[var(--color-fog)]">
                {m.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}