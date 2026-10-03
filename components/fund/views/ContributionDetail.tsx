"use client";

import Link from "next/link";
import type { ContributionDetailDto } from "@/components/fund/api";
import { resourceState } from "@/components/fund/common";
import { poolBase } from "@/components/fund/nav";
import { PageHeader, SectionCard } from "@/components/fund/parts";
import { useFund } from "@/components/fund/session";
import { usePoolResource } from "@/components/fund/useResource";
import { AuditTrail } from "@/components/fund/workflow";
import { ContributionReview, ContributionReviewActions } from "@/components/fund/views/ContributionReview";

export function ContributionDetail({ id }: { id: string }) {
  const { poolId } = useFund();
  const res = usePoolResource<ContributionDetailDto>(/^\d{1,9}$/.test(id) ? `contributions/${id}` : null);
  const state = /^\d{1,9}$/.test(id) ? resourceState(res, "the contribution") : null;
  const d = res.data;
  const c = d?.contribution;

  return (
    <>
      <PageHeader
        eyebrow={<Link href={`${poolBase(poolId)}/contributions`} className="underline-offset-2 hover:underline">← Contributions</Link>}
        title={c ? `Contribution #${c.id}` : "Contribution"}
        actions={d ? <ContributionReviewActions d={d} onDone={res.reload} /> : undefined}
      />
      {state ? (
        <SectionCard flush>{state}</SectionCard>
      ) : !c || !d ? (
        <SectionCard>Contribution not found.</SectionCard>
      ) : (
        <div className="space-y-6">
          <SectionCard flush>
            <ContributionReview d={d} onDone={res.reload} />
          </SectionCard>
          {d.audit && (
            <SectionCard title="Audit trail" flush>
              <AuditTrail items={d.audit} />
            </SectionCard>
          )}
        </div>
      )}
    </>
  );
}
