import { processSteps } from "@/lib/site-config";

export default function HowItWorks() {
  return (
    <section className="py-14 border-t border-[var(--color-line)]">
      <p className="font-mono text-sm text-[var(--color-red)] mb-2">HOW IT WORKS</p>
      <h2 className="font-display text-2xl md:text-3xl font-bold text-[var(--color-navy)] max-w-xl">
        What actually happens after you contact us
      </h2>

      <div className="mt-10 grid gap-0 md:grid-cols-5">
        {processSteps.map((s, i) => (
          <div key={s.step} className="relative pl-0 md:pl-6 md:pr-4 py-6 md:py-0 border-t md:border-t-0 md:border-l border-[var(--color-line)] first:border-t-0 first:md:border-l-0">
            <span className="font-display text-3xl font-bold text-[var(--color-gold)]">{s.step}</span>
            <h3 className="mt-2 font-display font-semibold text-[var(--color-navy)]">{s.title}</h3>
            <p className="mt-1.5 text-sm text-[var(--color-fog)] leading-relaxed">{s.description}</p>
            {i < processSteps.length - 1 && (
              <span className="hidden md:block absolute -right-2.5 top-8 text-[var(--color-line)] text-xl">→</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
