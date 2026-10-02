// Shown while the server checks the session and pool membership.
import { LoadingSkeleton, MetricsSkeleton } from "@/components/fund/parts";

export default function PoolsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <div aria-hidden="true" className="mb-7 border-b border-[var(--qf-line)]/70 pb-5">
        <div className="h-3 w-24 animate-pulse rounded bg-[var(--qf-cream-2)] motion-reduce:animate-none" />
        <div className="mt-3 h-8 w-56 animate-pulse rounded bg-[var(--qf-cream-2)] motion-reduce:animate-none" />
      </div>
      <MetricsSkeleton />
      <div className="mt-6 overflow-hidden rounded-xl border border-[var(--qf-line)]">
        <LoadingSkeleton label="Loading pools" />
      </div>
    </div>
  );
}
