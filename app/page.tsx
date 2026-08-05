import Link from "next/link";
import StatusStrip from "@/components/StatusStrip";
import HowItWorks from "@/components/HowItWorks";
import PricingTable from "@/components/PricingTable";
import OutcomePillars from "@/components/OutcomePillars";
import TrustBand from "@/components/TrustBand";
import Reveal from "@/components/Reveal";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="relative pt-14 pb-20 -mx-6 px-6 overflow-hidden">
        <div className="network-grid" aria-hidden="true" />

        <div className="relative">
          <p className="hero-eyebrow flex items-center gap-2">
            <span className="status-dot h-2 w-2 rounded-full bg-[var(--color-red)]" />
            Monitored around the clock
          </p>

          <h1 className="mt-4 font-display text-4xl md:text-6xl font-extrabold leading-[1.05] max-w-3xl text-[var(--color-navy)]">
            Your Remote{" "}
            <span className="underline-swipe">Technology Partner</span>
          </h1>

          <p className="mt-5 text-2xl md:text-3xl font-bold text-[var(--color-red)]">
            Complete Technology Ownership. One Trusted Partner.
          </p>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-fog)]">
            Stop managing multiple technology vendors. QCyberIndia becomes your single technology partner for cloud, networking, cybersecurity, websites, business email, and IT support. We take complete ownership of your technology so you can focus on growing your business.
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/contact" className="btn btn-primary">
              Book a free IT assessment
            </Link>
            <Link href="/solutions" className="btn btn-secondary">
              See what we take off your plate
            </Link>
          </div>

          <div className="mt-14 max-w-6xl">
            <StatusStrip />
          </div>
        </div>
      </section>

      {/* What We Manage */}
<section className="section border-t border-[var(--color-line)]">
  <div className="max-w-4xl">
    <p className="eyebrow mb-4">
      WHAT WE MANAGE
    </p>

    <h2 className="font-display text-3xl md:text-5xl font-extrabold leading-tight text-[var(--color-navy)]">
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

    <div className="mt-6 flex flex-wrap gap-2.5">
      {["Cloud Infrastructure", "Networking", "Cybersecurity", "Business Applications", "Websites", "IT Support"].map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-[var(--color-line)] bg-white px-3.5 py-1.5 text-xs font-medium text-[var(--color-navy)]"
        >
          {tag}
        </span>
      ))}
    </div>
  </div>

  <div className="mt-14">
    <OutcomePillars />
  </div>

  <div className="mt-10 flex justify-center">
    <Link href="/why-qcyberindia" className="btn btn-secondary">
      Learn why businesses choose one technology partner →
    </Link>
  </div>
</section>

      <TrustBand />

      {/* Who we serve */}
      <section className="section-tight border-t border-[var(--color-line)]">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <h2 className="font-display text-2xl md:text-3xl font-extrabold text-[var(--color-navy)]">
            Built for teams that don&apos;t want to run an IT department
          </h2>
          <Link href="/industries" className="eyebrow hover:underline">
            All industries →
          </Link>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            { label: "Startups", copy: "Skip hiring an in-house IT person before you need one. We're the infrastructure and support team you plug in on day one, and scale with as you grow." },
            { label: "MSMEs", copy: "Enterprise-grade IT — sized and priced for a growing business, so you're never one resignation away from an IT crisis." },
            { label: "Educational institutions", copy: "Labs, staff, and student networks, help desk included, with the documentation your board and auditors will ask for." },
          ].map((item, i) => (
            <Reveal key={item.label} delay={i * 80}>
              <div className="card p-6 h-full">
                <h3 className="eyebrow mb-4">{item.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-fog)]">{item.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <HowItWorks />
      <PricingTable />
    </div>
  );
}
