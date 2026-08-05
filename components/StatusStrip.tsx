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
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {statusMetrics.map((m) => {
          const Icon = icons[m.label as keyof typeof icons];

          return (
            <div
              key={m.label}
              className="group rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-red)] hover:shadow-lg"
            >
              {/* Header */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-paper-2)]">
                  <Icon
                    size={22}
                    className="text-[var(--color-navy)] transition-all duration-300 group-hover:scale-110"
                  />
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-fog)]">
                    {m.label}
                  </p>

                  <h3 className="text-xl font-extrabold leading-tight text-[var(--color-navy)]">
                    {m.value}
                  </h3>
                </div>
              </div>

              <div className="mt-4 h-1 w-10 rounded-full bg-[var(--color-gold)]" />

              <p className="mt-4 text-sm leading-6 text-[var(--color-fog)]">
                {m.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}