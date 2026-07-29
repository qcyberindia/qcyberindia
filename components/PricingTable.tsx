import Link from "next/link";
import { pricingTiers } from "@/lib/site-config";

export default function PricingTable() {
  return (
    <section className="py-14 border-t border-[var(--color-line)]">
      <p className="eyebrow mb-4">PLANS</p>
      <h2 className="font-display text-2xl md:text-3xl font-bold text-[var(--color-navy)] max-w-xl">
        One monthly plan, sized to your team
      </h2>
      <p className="mt-3 max-w-xl text-[var(--color-fog)]">
        No per-incident invoices. Every plan includes a free infrastructure assessment before you commit to anything —
        talk to us for pricing specific to your setup.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {pricingTiers.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-xl border p-7 flex flex-col ${
              tier.highlighted
                ? "border-[var(--color-red)] bg-white shadow-lg shadow-red-100 relative"
                : "border-[var(--color-line)] bg-white"
            }`}
          >
            {tier.highlighted && (
              <span className="absolute -top-3 left-7 rounded-full bg-[var(--color-red)] px-3 py-1 text-xs font-semibold text-white">
                Most common
              </span>
            )}
            <h3 className="font-display text-xl font-bold text-[var(--color-navy)]">{tier.name}</h3>
            <p className="mt-1 text-sm text-[var(--color-fog)]">{tier.audience}</p>
            <ul className="mt-5 space-y-2.5 flex-1">
              {tier.features.map((f) => (
                <li key={f} className="text-sm text-[var(--color-fog)] flex gap-2">
                  <span className="text-[var(--color-gold)] font-bold">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/contact"
              className={`mt-6 inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${
                tier.highlighted
                  ? "bg-[var(--color-red)] text-white hover:bg-[var(--color-red-deep)]"
                  : "border border-[var(--color-navy)] text-[var(--color-navy)] hover:bg-[var(--color-navy)] hover:text-white"
              }`}
            >
              Talk to us
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
