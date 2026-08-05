import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";
import { industries } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Industries",
  description: "QCyberIndia supports startups, MSMEs, educational institutions, and more across India.",
};

export default function IndustriesPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <PageHeader
        eyebrow="Industries"
        title="We understand your industry, not just your infrastructure"
        description="Business owners look for a partner who understands how their industry actually runs — not just someone who can configure a firewall."
      />

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {industries.map((ind, i) => (
          <Reveal key={ind.id} delay={(i % 4) * 60}>
            <div className="card p-6 h-full">
              <h3 className="font-display font-bold text-[var(--color-navy)]">{ind.name}</h3>
              <p className="mt-2 text-sm text-[var(--color-fog)] leading-relaxed">{ind.note}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="mt-14 text-center">
        <p className="text-[var(--color-fog)]">Don&apos;t see your industry listed?</p>
        <Link href="/contact" className="mt-4 btn btn-primary">
          Tell us about your business
        </Link>
      </div>
    </div>
  );
}
