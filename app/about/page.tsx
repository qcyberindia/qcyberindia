import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Why QCyberIndia exists — the remote IT partner for startups, MSMEs, and educational institutions in India.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-sm text-[var(--color-red)] mb-4">ABOUT</p>
      <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--color-navy)]">
        The IT department you don't have to hire, manage, or worry about
      </h1>
      <div className="mt-8 space-y-5 text-[var(--color-fog)] leading-relaxed">
        <p>
          QCyberIndia started from a simple observation: most startups, MSMEs, and educational
          institutions in India can't justify hiring a full in-house IT team — but they need one
          just as much as a larger company does. A single misconfigured firewall, an unmonitored
          server, or a help desk nobody's watching is the same risk whether you have 10 employees
          or 10,000.
        </p>
        <p>
          We work as your remote IT department: managed IT support, infrastructure, security,
          business applications, and growth guidance, run the way we'd want it run for our own
          systems — segmented, monitored, and documented, not duct-taped together and hoped upon.
          You pay one predictable bill and never have to wonder who's responsible when something
          needs attention.
        </p>
        <p>
          We don't want to be another cybersecurity vendor or hosting company you occasionally
          call. We want to be the answer when someone on your team asks, "who handles our IT?" —
          every engagement starts with understanding how your business actually works, not fitting
          you into a generic package.
        </p>
      </div>
    </div>
  );
}
