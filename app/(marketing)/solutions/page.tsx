import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileSearch } from "lucide-react";
import OutcomePillars from "@/components/OutcomePillars";
import PageHeader from "@/components/PageHeader";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "QCyberIndia takes complete ownership of your technology — keeping your business running, protecting it, building its infrastructure, and helping it grow.",
};

export default function SolutionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <PageHeader
        eyebrow="Solutions"
        title="We don't sell technology. We take ownership of it."
        description={
          <>You shouldn&apos;t need to know what&apos;s running behind the scenes to trust that it&apos;s handled.
          Here&apos;s what &quot;{siteConfig.promise}&quot; actually covers.</>
        }
      />

      <div className="mt-10">
        <OutcomePillars />
      </div>

      <div className="relative mt-14 overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white p-8 shadow-sm">
        <span className="absolute inset-x-0 top-0 h-1 bg-[var(--color-gold)]" aria-hidden="true" />
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-gold)]/15">
              <FileSearch size={22} className="text-[#a06e00]" />
            </div>
            <div>
              <p className="font-display text-xl font-bold text-[var(--color-navy)]">
                Want the technical detail behind each solution?
              </p>
              <p className="mt-2 max-w-lg text-[var(--color-fog)]">
                The Services page breaks each of these down into the specific capabilities we deliver.
              </p>
            </div>
          </div>
          <Link
            href="/services"
            className="btn btn-secondary group shrink-0 whitespace-nowrap"
          >
            View detailed services
            <ArrowRight size={16} className="ml-1.5 transition-transform duration-200 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
