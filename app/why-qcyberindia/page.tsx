import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Why QCyberIndia",
  description: "Why business owners choose QCyberIndia as their remote IT partner — our process, ownership model, and philosophy.",
};

const pillars = [
  {
    title: "One point of contact",
    body: "When something needs attention — a laptop, a firewall rule, a renewal — you send one message. We figure out who inside our team handles it. You never have to know or care.",
  },
  {
    title: "Documentation, not tribal knowledge",
    body: "Every network we touch gets a written SOP: how it's configured, why, and how to recover it. If we're ever unavailable, your systems aren't a black box only we understand.",
  },
  {
    title: "Security first, not security eventually",
    body: "New setups get segmented networks and hardened defaults from day one — not retrofitted after an incident forces the conversation.",
  },
  {
    title: "Proactive, not reactive",
    body: "We'd rather flag a failing backup job before it matters than explain why a restore didn't work after it did. Monitoring exists to prevent calls, not just log them.",
  },
  {
    title: "Honest scope",
    body: "If something is outside what we can respectably support, we say so upfront instead of taking the engagement anyway. Trust matters more than a signed contract we can't deliver on.",
  },
];

export default function WhyQCyberIndiaPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-sm text-[var(--color-red)] mb-4">WHY QCYBERINDIA</p>
      <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--color-navy)]">
        Why trust us instead of another IT company?
      </h1>
      <p className="mt-4 text-[var(--color-fog)] leading-relaxed">
        Fair question — we&apos;re a newer partner, not a 20-year-old firm with a wall of logos. Here&apos;s
        what we can honestly stand behind instead: how we work, and what we commit to before you
        sign anything.
      </p>

      <div className="mt-10 space-y-8">
        {pillars.map((p) => (
          <div key={p.title} className="border-l-2 border-[var(--color-gold)] pl-5">
            <h3 className="font-display font-semibold text-lg text-[var(--color-navy)]">{p.title}</h3>
            <p className="mt-1.5 text-[var(--color-fog)] leading-relaxed">{p.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 rounded-xl border border-[var(--color-line)] bg-white p-8">
        <p className="font-display text-xl font-semibold text-[var(--color-navy)]">
          Not sure yet? Start with the free assessment.
        </p>
        <p className="mt-2 text-[var(--color-fog)]">
          No commitment — we look at your current setup, tell you honestly what needs attention,
          and you decide from there whether {siteConfig.name} is the right fit.
        </p>
        <Link
          href="/contact"
          className="mt-5 inline-flex items-center rounded-md bg-[var(--color-red)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-red-deep)] transition-colors"
        >
          Book a free IT assessment
        </Link>
      </div>
    </div>
  );
}
