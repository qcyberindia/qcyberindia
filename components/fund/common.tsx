"use client";

import Link from "next/link";
import type { ApiError } from "@/components/fund/api";
import { EmptyState, ErrorState, LoadingSkeleton, SectionCard } from "@/components/fund/parts";
import { poolBase } from "@/components/fund/nav";
import { useFund } from "@/components/fund/session";

/**
 * The first thing every screen resolves: still loading, failed, or ready.
 * Returns the node to render for loading/error, or null when data is ready.
 */
export function resourceState(
  res: { loading: boolean; error: ApiError | null; reload: () => void },
  label: string
): React.ReactNode | null {
  if (res.loading) return <LoadingSkeleton label={`Loading ${label}`} />;
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  return null;
}

/** Shown instead of a screen when the role has no access to it. */
export function NoAccess({ what }: { what: string }) {
  const { poolId } = useFund();
  return (
    <SectionCard>
      <EmptyState
        title="You do not have access to this section"
        description={`${what} is available to pool administrators or managers. If you think this is a mistake, ask a pool administrator.`}
        action={
          <Link href={`${poolBase(poolId)}/dashboard`} className="text-[14px] font-semibold text-[var(--qf-brass-dark)] underline underline-offset-2">
            Back to the dashboard
          </Link>
        }
      />
    </SectionCard>
  );
}

/** Link text for a record's owner when the API supplies no display name. */
export function memberLabel(name: string | null | undefined, id: number): string {
  return name && name.trim() ? name : `Member #${id}`;
}

/**
 * Research links are free text typed by a member, so only http(s) URLs are
 * ever turned into links (never javascript: or data: URLs).
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Date filters shared by list and report screens (YYYY-MM-DD, inclusive). */
export type DateRange = { from: string; to: string };

/** Reads server field errors (`ApiError.fields`) for a form field. */
export function fieldError(fields: Record<string, string> | undefined, local: Record<string, string>, key: string) {
  return local[key] ?? fields?.[key] ?? null;
}

/** True when `value` is a positive decimal with at most `dp` places (string check, no arithmetic). */
export function isPositiveDecimal(value: string, dp: number): boolean {
  const re = new RegExp(`^\\d+(\\.\\d{1,${dp}})?$`);
  return re.test(value) && /[1-9]/.test(value);
}
