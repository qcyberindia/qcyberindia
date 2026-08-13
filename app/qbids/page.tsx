import type { Metadata } from "next";
import Link from "next/link";
import { Search, FileText, Users, Clock, ArrowRight, PlayCircle } from "lucide-react";
import QbidsRegisterForm from "@/components/QbidsRegisterForm";
import QbidsShowcase from "@/components/QbidsShowcase";
import Reveal from "@/components/Reveal";

const title = "Qbids — Your Bids Workspace";
const description =
  "Qbids brings the work around a government tender bid — documents, requirements, tasks, and your team — into one workspace. Join the beta.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/qbids" },
  openGraph: {
    title,
    description,
    url: "/qbids",
    type: "website",
    images: [{ url: "/qbids/dashboard.png", width: 1200, height: 694, alt: "The Qbids dashboard" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/qbids/dashboard.png"],
  },
};

const problemChips = ["GeM", "CPPP", "State Portals", "PDFs", "Excel", "Email", "WhatsApp"];

const capabilities = [
  {
    Icon: Search,
    step: "01",
    title: "Discover",
    copy: "Find relevant tender opportunities across the portals you already work with.",
  },
  {
    Icon: FileText,
    step: "02",
    title: "Understand",
    copy: "Bring tender information, documents, and requirements into one place.",
  },
  {
    Icon: Users,
    step: "03",
    title: "Collaborate",
    copy: "Assign tasks, organize documents, and work the bid with your team.",
  },
  {
    Icon: Clock,
    step: "04",
    title: "Manage",
    copy: "Track deadlines, requirements, and bid progress without losing the thread.",
  },
];

const demoUrl = process.env.NEXT_PUBLIC_QBIDS_DEMO_URL;

export default function QbidsPage() {
  return (
    <div className="min-h-screen bg-[#0c1016] text-[#e6edf3]">
      {/* Top bar — intentionally not the QCyberIndia nav */}
      <header className="sticky top-0 z-20 border-b border-[#1e2a38] bg-[#0c1016]/90 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-display font-semibold tracking-tight text-[#e6edf3]">
            Q<span className="text-[#3fd0c9]">bids</span>
          </span>
          <a
            href="#join"
            className="rounded-md bg-[#3fd0c9] px-4 py-1.5 text-sm font-semibold text-[#0c1016] transition-colors hover:bg-[#22968f]"
          >
            Join the beta
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="network-grid on-dark" />
        <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-20 text-center sm:pt-28">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#3fd0c9]/25 bg-[#3fd0c9]/10 px-3.5 py-1 font-display text-xs font-semibold uppercase tracking-[0.14em] text-[#3fd0c9]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3fd0c9] status-dot" aria-hidden="true" />
              Qbids beta
            </p>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-5 font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Your Bids Workspace
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-5 text-lg text-[#8aa0b4]">From tender to bid — one workspace.</p>
            <p className="mx-auto mt-4 max-w-xl text-[#8aa0b4]">
              Discover opportunities, understand requirements, organize documents, and manage your
              bidding workflow with your team — all in one place.
            </p>
          </Reveal>

          <Reveal delay={200}>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="#discover"
                className="inline-flex items-center gap-2 rounded-md border border-[#1e2a38] px-6 py-3 font-medium text-[#e6edf3] transition-colors hover:border-[#3fd0c9]/50 hover:bg-[#111823]"
              >
                <PlayCircle size={17} className="text-[#3fd0c9]" />
                See Qbids in Action
              </a>
              <a
                href="#join"
                className="group inline-flex items-center gap-2 rounded-md bg-[#3fd0c9] px-6 py-3 font-semibold text-[#0c1016] transition-colors hover:bg-[#22968f]"
              >
                Join the Beta
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>

            <p className="mt-6 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#8aa0b4]">
              Beta registration opens August 15, 2026
            </p>
          </Reveal>
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-[#1e2a38] bg-[#0a0e13] py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Reveal>
            <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-[#3fd0c9]">
              The problem
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Your bid shouldn&apos;t live across ten different places.
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
              {problemChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-[#1e2a38] bg-[#111823] px-4 py-1.5 text-sm text-[#8aa0b4] transition-colors hover:border-[#3fd0c9]/30 hover:text-[#e6edf3]"
                >
                  {chip}
                </span>
              ))}
            </div>
            <p className="mt-8 text-[#8aa0b4]">
              Qbids brings the work around your bids into one workspace.
            </p>
          </Reveal>
        </div>
      </section>

      {/* See Qbids in action — real product screenshots, not a video */}
      <QbidsShowcase />

      {/* Optional video, secondary to the screenshots above */}
      {demoUrl && (
        <section id="demo" className="border-t border-[#1e2a38] py-16">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <p className="text-sm text-[#8aa0b4]">Prefer a quick tour?</p>
            <div className="mt-6 overflow-hidden rounded-xl border border-[#1e2a38] bg-[#111823]">
              <div className="aspect-video">
                <iframe
                  src={demoUrl}
                  title="Qbids demo"
                  className="h-full w-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Capabilities */}
      <section className="border-t border-[#1e2a38] bg-[#0a0e13] py-20">
        <div className="mx-auto max-w-5xl px-6">
          <Reveal>
            <div className="text-center">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-[#3fd0c9]">
                How it works
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Built for teams that bid.
              </h2>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(({ Icon, step, title, copy }, i) => (
              <Reveal key={title} delay={i * 90}>
                <div className="group relative h-full rounded-xl border border-[#1e2a38] bg-[#111823] p-6 transition-colors hover:border-[#3fd0c9]/30">
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3fd0c9]/10 transition-colors group-hover:bg-[#3fd0c9]/15">
                      <Icon size={18} className="text-[#3fd0c9]" />
                    </div>
                    <span className="font-display text-xs font-semibold text-[#1e2a38] transition-colors group-hover:text-[#3fd0c9]/40">
                      {step}
                    </span>
                  </div>
                  <p className="mt-4 font-display font-semibold text-[#e6edf3]">{title}</p>
                  <p className="mt-1.5 text-sm text-[#8aa0b4]">{copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Registration */}
      <section id="join" className="relative overflow-hidden py-20">
        <div className="network-grid on-dark opacity-50" />
        <div className="relative mx-auto max-w-2xl px-6">
          <Reveal>
            <div className="text-center">
              <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-[#3fd0c9]">
                Get access
              </p>
              <h2 className="mt-3 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Join the Qbids Beta
              </h2>
              <p className="mx-auto mt-3 max-w-md text-[#8aa0b4]">
                We&apos;re inviting businesses that actively participate in government bidding to try
                the first version of Qbids.
              </p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-10">
              <QbidsRegisterForm />
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-[#1e2a38] py-8 text-center text-xs text-[#8aa0b4]">
        <Link href="/" className="hover:text-[#e6edf3]">
          © {new Date().getFullYear()} Qbids, by QCyberIndia
        </Link>
      </footer>
    </div>
  );
}
