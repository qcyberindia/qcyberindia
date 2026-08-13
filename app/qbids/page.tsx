import type { Metadata } from "next";
import Link from "next/link";
import { Search, FileText, Users, Clock } from "lucide-react";
import QbidsRegisterForm from "@/components/QbidsRegisterForm";
import QbidsShowcase from "@/components/QbidsShowcase";

export const metadata: Metadata = {
  title: "Qbids — Your Bids Workspace",
  description:
    "Qbids brings the work around a government tender bid — documents, requirements, tasks, and your team — into one workspace. Join the beta.",
};

const problemChips = ["GeM", "CPPP", "State Portals", "PDFs", "Excel", "Email", "WhatsApp"];

const capabilities = [
  {
    Icon: Search,
    title: "Discover",
    copy: "Find relevant tender opportunities across the portals you already work with.",
  },
  {
    Icon: FileText,
    title: "Understand",
    copy: "Bring tender information, documents, and requirements into one place.",
  },
  {
    Icon: Users,
    title: "Collaborate",
    copy: "Assign tasks, organize documents, and work the bid with your team.",
  },
  {
    Icon: Clock,
    title: "Manage",
    copy: "Track deadlines, requirements, and bid progress without losing the thread.",
  },
];

const demoUrl = process.env.NEXT_PUBLIC_QBIDS_DEMO_URL;

export default function QbidsPage() {
  return (
    <div className="min-h-screen bg-[#0c1016] text-[#e6edf3]">
      {/* Minimal top bar — intentionally not the QCyberIndia nav */}
      <header className="border-b border-[#1e2a38]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="font-semibold tracking-tight text-[#e6edf3]">
            Q<span className="text-[#3fd0c9]">bids</span>
          </span>
          <a
            href="#join"
            className="rounded-md border border-[#1e2a38] px-3.5 py-1.5 text-sm text-[#8aa0b4] transition-colors hover:border-[#3fd0c9]/50 hover:text-[#e6edf3]"
          >
            Join the beta
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pb-20 pt-20 text-center sm:pt-28">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#3fd0c9]">Qbids</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Your Bids Workspace</h1>
        <p className="mt-5 text-lg text-[#8aa0b4]">From tender to bid — one workspace.</p>
        <p className="mx-auto mt-4 max-w-xl text-[#8aa0b4]">
          Discover opportunities, understand requirements, organize documents, and manage your
          bidding workflow with your team — all in one place.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#discover"
            className="inline-flex items-center gap-2 rounded-md border border-[#1e2a38] px-6 py-3 font-medium text-[#e6edf3] transition-colors hover:border-[#3fd0c9]/50"
          >
            See Qbids in Action
          </a>
          <a
            href="#join"
            className="rounded-md bg-[#3fd0c9] px-6 py-3 font-semibold text-[#0c1016] transition-colors hover:bg-[#22968f]"
          >
            Join the Beta
          </a>
        </div>

        <p className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-[#8aa0b4]">
          Beta registration opens August 15, 2026
        </p>
      </section>

      {/* Problem */}
      <section className="border-t border-[#1e2a38] bg-[#0a0e13] py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Your bid shouldn&apos;t live across ten different places.
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
            {problemChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-[#1e2a38] bg-[#111823] px-4 py-1.5 text-sm text-[#8aa0b4]"
              >
                {chip}
              </span>
            ))}
          </div>
          <p className="mt-8 text-[#8aa0b4]">
            Qbids brings the work around your bids into one workspace.
          </p>
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
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">Built for teams that bid.</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map(({ Icon, title, copy }) => (
              <div key={title} className="rounded-xl border border-[#1e2a38] bg-[#111823] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3fd0c9]/10">
                  <Icon size={18} className="text-[#3fd0c9]" />
                </div>
                <p className="mt-4 font-semibold text-[#e6edf3]">{title}</p>
                <p className="mt-1.5 text-sm text-[#8aa0b4]">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Registration */}
      <section id="join" className="py-20">
        <div className="mx-auto max-w-2xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold sm:text-3xl">Join the Qbids Beta</h2>
            <p className="mt-3 text-[#8aa0b4]">
              We&apos;re inviting businesses that actively participate in government bidding to try
              the first version of Qbids.
            </p>
          </div>
          <div className="mt-10">
            <QbidsRegisterForm />
          </div>
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
