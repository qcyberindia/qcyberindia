import type { Metadata } from "next";
import Link from "next/link";
import { industries } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Industries",
  description: "QCyberIndia supports startups, MSMEs, educational institutions, and more across India.",
};

export default function IndustriesPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <p className="font-mono text-sm text-[var(--color-red)] mb-4">INDUSTRIES</p>
      <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--color-navy)] max-w-2xl">
        We understand your industry, not just your infrastructure
      </h1>
      <p className="mt-4 max-w-xl text-[var(--color-fog)]">
        Business owners look for a partner who understands how their industry actually runs — not
        just someone who can configure a firewall.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {industries.map((ind) => (
          <div key={ind.id} className="rounded-xl border border-[var(--color-line)] bg-white p-6">
            <h3 className="font-display font-semibold text-[var(--color-navy)]">{ind.name}</h3>
            <p className="mt-2 text-sm text-[var(--color-fog)] leading-relaxed">{ind.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 text-center">
        <p className="text-[var(--color-fog)]">Don&apos;t see your industry listed?</p>
        <Link
          href="/contact"
          className="mt-4 inline-flex items-center rounded-md bg-[var(--color-red)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-red-deep)] transition-colors"
        >
          Tell us about your business
        </Link>
      </div>
    </div>
  );
}
