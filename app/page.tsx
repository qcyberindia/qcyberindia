import Link from "next/link";
import StatusStrip from "@/components/StatusStrip";
import HowItWorks from "@/components/HowItWorks";
import PricingTable from "@/components/PricingTable";
import OutcomePillars from "@/components/OutcomePillars";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="pt-20 pb-16">
        <p className="font-mono text-sm text-[var(--color-red)] mb-4">MANAGED TECHNOLOGY PARTNER</p>
        <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.1] max-w-3xl text-[var(--color-navy)]">
          Complete IT <span className="underline-swipe">ownership</span>. So you don&apos;t have to think about it.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-[var(--color-fog)] leading-relaxed">
          Stop calling your ISP, your website developer, your email provider, and your firewall
          consultant separately. Call one partner. We coordinate everything, resolve issues, and
          take accountability — so your business has an IT department without you having to build one.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/contact"
            className="inline-flex items-center rounded-md bg-[var(--color-red)] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[var(--color-red-deep)] transition-colors"
          >
            Book a free IT assessment
          </Link>
          <Link
            href="/solutions"
            className="inline-flex items-center rounded-md border border-[var(--color-navy)] px-6 py-3.5 text-sm font-semibold text-[var(--color-navy)] hover:bg-[var(--color-navy)] hover:text-white transition-colors"
          >
            See what we take off your plate
          </Link>
        </div>

        <div className="mt-12 max-w-xl">
          <StatusStrip />
        </div>
      </section>

      {/* Outcomes, not technologies */}
      <section className="py-14 border-t border-[var(--color-line)]">
        <p className="font-mono text-sm text-[var(--color-red)] mb-2">WHAT WE TAKE OWNERSHIP OF</p>
        <h2 className="font-display text-2xl md:text-3xl font-bold text-[var(--color-navy)] max-w-xl">
          Think of it like a hospital, not a hardware store
        </h2>
        <p className="mt-3 max-w-xl text-[var(--color-fog)]">
          A hospital doesn&apos;t advertise its MRI machine — it promises complete healthcare. We work the
          same way: four departments, one accountable team.
        </p>
        <div className="mt-8">
          <OutcomePillars />
        </div>
        <div className="mt-6">
          <Link href="/why-qcyberindia" className="font-mono text-sm text-[var(--color-red)] hover:underline">
            Why business owners trust us with this →
          </Link>
        </div>
      </section>

      {/* Who we serve */}
      <section className="py-14 border-t border-[var(--color-line)]">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[var(--color-navy)]">
            Built for teams that don&apos;t want to run an IT department
          </h2>
          <Link href="/industries" className="font-mono text-sm text-[var(--color-red)] hover:underline">
            All industries →
          </Link>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            { label: "Startups", copy: "Skip hiring an in-house IT person before you need one. We're the infrastructure and support team you plug in on day one, and scale with as you grow." },
            { label: "MSMEs", copy: "Enterprise-grade IT — sized and priced for a growing business, so you're never one resignation away from an IT crisis." },
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
      <PricingTable />
    </div>
  );
}
