import Link from "next/link";
import StatusStrip from "@/components/StatusStrip";
import HowItWorks from "@/components/HowItWorks";
import PricingTable from "@/components/PricingTable";
import { serviceCategories, siteConfig } from "@/lib/site-config";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="pt-20 pb-16">
        <p className="font-mono text-sm text-[var(--color-red)] mb-4">REMOTE IT PARTNER FOR GROWING BUSINESSES</p>
        <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.1] max-w-3xl text-[var(--color-navy)]">
          {siteConfig.tagline}. <span className="underline-swipe">Stop worrying</span> about technology.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-[var(--color-fog)] leading-relaxed">
          From laptops and business email to cloud infrastructure, cybersecurity, networking,
          backups, monitoring, and employee support — we manage your technology so your team can
          focus on customers.
        </p>
        <p className="mt-3 font-display font-semibold text-[var(--color-navy)]">
          One Partner. One Monthly Plan. Complete IT Ownership.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/contact"
            className="inline-flex items-center rounded-md bg-[var(--color-red)] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[var(--color-red-deep)] transition-colors"
          >
            Book a free IT assessment
          </Link>
          <Link
            href="/services"
            className="inline-flex items-center rounded-md border border-[var(--color-navy)] px-6 py-3.5 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-navy)] hover:text-white transition-colors"
          >
            See what we manage
          </Link>
        </div>

        <div className="mt-12 max-w-xl">
          <StatusStrip />
        </div>
      </section>

      {/* Who we serve */}
      <section className="py-14 border-t border-[var(--color-line)]">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-[var(--color-navy)]">
          Built for teams that don't want to run an IT department
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            { label: "Startups", copy: "Skip hiring an in-house IT person before you need one. We're the infrastructure and support team you plug in on day one, and scale with as you grow." },
            { label: "MSMEs", copy: "Enterprise-grade network, security, and support — sized and priced for a growing business, so you're never one resignation away from an IT crisis." },
            { label: "Educational institutions", copy: "Labs, staff, and student networks, help desk included, with the documentation your board and auditors will ask for." },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-[var(--color-line)] bg-white p-6">
              <h3 className="font-mono text-sm text-[var(--color-red)]">{item.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-fog)]">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      <HowItWorks />

      {/* Service pyramid preview */}
      <section className="py-14 border-t border-[var(--color-line)]">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[var(--color-navy)]">Everything an in-house IT team would cover</h2>
          <Link href="/services" className="font-mono text-sm text-[var(--color-red)] hover:underline">
            All services →
          </Link>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {serviceCategories.map((cat) => (
            <div key={cat.id} className="rounded-xl border border-[var(--color-line)] bg-white p-6">
              <h3 className="font-display font-semibold text-[var(--color-navy)]">{cat.title}</h3>
              <p className="mt-2 text-sm text-[var(--color-fog)]">{cat.summary}</p>
            </div>
          ))}
        </div>
      </section>

      <PricingTable />
    </div>
  );
}
