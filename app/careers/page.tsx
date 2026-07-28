import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Careers",
  description: "Open roles at QCyberIndia.",
};

export default function CareersPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-sm text-[var(--color-red)] mb-4">CAREERS</p>
      <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--color-navy)]">
        No open roles right now
      </h1>
      <p className="mt-4 text-[var(--color-fog)] leading-relaxed max-w-xl">
        We&apos;re a small, hands-on team today, but we&apos;re growing. If you work with network
        infrastructure, security operations, or cloud hosting and want to be first in line when a
        role opens, send your resume to{" "}
        <a href={`mailto:${siteConfig.email.careers}`} className="text-[var(--color-red)] hover:underline">
          {siteConfig.email.careers}
        </a>
        .
      </p>
    </div>
  );
}
