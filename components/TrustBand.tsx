import Link from "next/link";

export default function TrustBand() {
  return (
    <section className="section-dark relative -mx-6 px-6 overflow-hidden">
      <div className="network-grid on-dark" aria-hidden="true" />

      <div className="relative mx-auto max-w-3xl py-16 text-center">
        <p className="eyebrow mb-4">Why it works</p>
        <h2 className="font-display text-2xl md:text-4xl font-extrabold leading-tight">
          One team accountable for every system you run — not four vendors pointing at each other.
        </h2>
        <p className="mt-5 text-white/70 leading-relaxed max-w-xl mx-auto">
          When something breaks at 2am, you make one call. No hand-offs between your hosting
          provider, your firewall vendor, and whoever built your website.
        </p>
        <Link href="/why-qcyberindia" className="mt-8 btn btn-primary">
          See why teams choose one partner
        </Link>
      </div>
    </section>
  );
}
