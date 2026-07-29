import Link from "next/link";
import StatusStrip from "@/components/StatusStrip";
import HowItWorks from "@/components/HowItWorks";
import PricingTable from "@/components/PricingTable";
import OutcomePillars from "@/components/OutcomePillars";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="pt-12 pb-16">
       <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] max-w-3xl text-[var(--color-navy)]">
        Your Remote{" "}
       <span className="underline-swipe">
        Technology Partner
       </span>
       </h1>

       <p className="mt-5 text-2xl md:text-3xl font-semibold text-[var(--color-red)]">
       Complete Technology Ownership. One Trusted Partner.
       </p>

       <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-fog)]">
        Stop managing multiple technology vendors. QCyberIndia becomes your single technology partner for cloud, networking, cybersecurity, websites, business email, and IT support. We take complete ownership of your technology so you can focus on growing your business.
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

        <div className="mt-12 max-w-6xl">
        <StatusStrip />
        </div>
      </section>

      {/* What We Manage */}
<section className="py-20 border-t border-[var(--color-line)]">
  <div className="max-w-4xl">
    <p className="eyebrow mb-4">
      WHAT WE MANAGE
    </p>

    <h2 className="font-display text-3xl md:text-5xl font-bold leading-tight text-[var(--color-navy)]">
      One Partner.
      <br />
      Every Technology Your Business Depends On.
    </h2>

    <p className="mt-6 text-lg leading-8 text-[var(--color-fog)]">
      We don't sell isolated IT services. We take complete ownership of your
      technology environment—from cloud infrastructure and cybersecurity to
      networking, business applications, websites, and day-to-day IT support.
      One trusted partner. One accountable team. Zero vendor confusion.
    </p>
  </div>

  <div className="mt-14">
    <OutcomePillars />
  </div>

  <div className="mt-10 flex justify-center">
    <Link
      href="/why-qcyberindia"
      className="inline-flex items-center rounded-md border border-[var(--color-red)] px-6 py-3 text-sm font-semibold text-[var(--color-red)] transition-all duration-300 hover:bg-[var(--color-red)] hover:text-white"
    >
      Learn Why Businesses Choose One Technology Partner →
    </Link>
  </div>
</section>

      {/* Who we serve */}
      <section className="py-14 border-t border-[var(--color-line)]">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-[var(--color-navy)]">
            Built for teams that don&apos;t want to run an IT department
          </h2>
          <Link
           href="/industries"
           className="eyebrow hover:underline"
          >
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
              <h3 className="eyebrow mb-4">{item.label}</h3>
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
