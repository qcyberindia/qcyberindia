import type { Metadata } from "next";
import Link from "next/link";
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

      <div className="mt-14 card p-8 text-center">
        <p className="font-display text-xl font-bold text-[var(--color-navy)]">
          Want the technical detail behind each solution?
        </p>
        <p className="mt-2 text-[var(--color-fog)]">
          The Services page breaks each of these down into the specific capabilities we deliver.
        </p>
        <Link href="/services" className="mt-5 btn btn-secondary">
          View detailed services
        </Link>
      </div>
    </div>
  );
}
