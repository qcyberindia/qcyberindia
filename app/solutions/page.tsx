import type { Metadata } from "next";
import Link from "next/link";
import OutcomePillars from "@/components/OutcomePillars";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Solutions",
  description:
    "QCyberIndia takes complete ownership of your technology — keeping your business running, protecting it, building its infrastructure, and helping it grow.",
};

export default function SolutionsPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <p className="eyebrow mb-4">SOLUTIONS</p>
      <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--color-navy)] max-w-2xl">
        We don&apos;t sell technology. We take ownership of it.
      </h1>
      <p className="mt-4 max-w-xl text-[var(--color-fog)]">
        You shouldn&apos;t need to know what&apos;s running behind the scenes to trust that it&apos;s handled.
        Here&apos;s what &quot;{siteConfig.promise}&quot; actually covers.
      </p>

      <div className="mt-10">
        <OutcomePillars />
      </div>

      <div className="mt-14 rounded-xl border border-[var(--color-line)] bg-white p-8 text-center">
        <p className="font-display text-xl font-semibold text-[var(--color-navy)]">
          Want the technical detail behind each solution?
        </p>
        <p className="mt-2 text-[var(--color-fog)]">
          The Services page breaks each of these down into the specific capabilities we deliver.
        </p>
        <Link
          href="/services"
          className="mt-5 inline-flex items-center rounded-md bg-[var(--color-navy)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          View detailed services
        </Link>
      </div>
    </div>
  );
}
