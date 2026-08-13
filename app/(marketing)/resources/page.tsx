import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Resources",
  description: "Guides, checklists, and notes from QCyberIndia on infrastructure, security, and IT operations.",
};

const resources = [
  {
    title: "Blog",
    description: "Notes on infrastructure, security, and running reliable systems.",
    href: "/blog",
    status: "live" as const,
  },
  {
    title: "IT Checklists",
    description: "Practical, downloadable checklists for onboarding, backups, and security basics.",
    href: null,
    status: "coming-soon" as const,
  },
  {
    title: "Case Studies",
    description: "Real engagements and outcomes, published as we complete our first client projects.",
    href: null,
    status: "coming-soon" as const,
  },
  {
    title: "FAQs",
    description: "Common questions about how a managed IT partnership works, day to day.",
    href: null,
    status: "coming-soon" as const,
  },
];

export default function ResourcesPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <PageHeader eyebrow="Resources" title="Notes, checklists, and guides" description={siteConfig.subTagline} />

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {resources.map((r) => {
          const content = (
            <div className={`card p-6 h-full ${r.href ? "" : "opacity-70"}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-[var(--color-navy)]">{r.title}</h3>
                {r.status === "coming-soon" && (
                  <span className="text-xs font-mono text-[var(--color-gold)] border border-[var(--color-gold)]/40 rounded-full px-2 py-0.5">
                    Coming soon
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-[var(--color-fog)] leading-relaxed">{r.description}</p>
            </div>
          );
          return r.href ? (
            <Link key={r.title} href={r.href}>
              {content}
            </Link>
          ) : (
            <div key={r.title}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
