import type { Metadata } from "next";
import Link from "next/link";
import QFineraPage from "@/components/qfinance/QFineraPage";
import { PoolGuideContent } from "@/components/fund/views/GuideView";

export const metadata: Metadata = {
  title: "Pool Guide",
  description: "How a QFinera pool works: roles, contributions, units and NAV, trades, P&L, approvals and the audit trail.",
  alternates: { canonical: "/qfinera/learn/pool-guide" },
};

export default function PoolGuidePage() {
  return (
    <QFineraPage
      eyebrow="Learn · Pool Guide"
      title="How a pool works"
      description="A pool is one shared, accurate book for a group that invests together. Here is everything it tracks, in plain language."
      actions={
        <Link
          href="/qfinera/pools"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--qf-brass-dark)] px-5 font-display text-[15px] font-semibold text-[var(--qf-cream-0)] hover:opacity-90"
        >
          Go to Pools
        </Link>
      }
    >
      <PoolGuideContent />
    </QFineraPage>
  );
}
