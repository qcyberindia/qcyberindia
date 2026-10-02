"use client";

import { useState } from "react";
import type { Audit, Paged } from "@/components/fund/api";
import { NoAccess, resourceState } from "@/components/fund/common";
import { inputClass } from "@/components/fund/forms";
import { Disclaimer, EmptyState, PageHeader, SectionCard } from "@/components/fund/parts";
import { useCan } from "@/components/fund/session";
import { FilterBar, FilterField, Pagination } from "@/components/fund/table";
import { usePoolResource } from "@/components/fund/useResource";
import { AuditTrail } from "@/components/fund/workflow";

const ENTITY_TYPES = ["pool", "member", "invite", "contribution", "withdrawal", "trade", "expense", "nav_snapshot", "price_snapshot", "instrument", "watchlist_item", "settings"];

export function AuditView() {
  const can = useCan();
  const [entityType, setEntityType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const res = usePoolResource<Paged<"audit", Audit>>(can("audit:view") ? "audit" : null, { entityType, from, to, page });
  if (!can("audit:view")) return <NoAccess what="The audit log" />;
  const state = resourceState(res, "the audit log");
  const rows = res.data?.audit ?? [];

  return (
    <>
      <PageHeader title="Audit log" description="Every sensitive action in this pool, with who, when, what changed and why." />
      <div className="mb-4">
        <Disclaimer>The audit log is append-only: entries cannot be edited or deleted, by anyone, through the application or the database.</Disclaimer>
      </div>
      <FilterBar dirty={Boolean(entityType || from || to)} onReset={() => { setEntityType(""); setFrom(""); setTo(""); setPage(1); }}>
        <FilterField label="Record type">
          {(id) => (
            <select id={id} className={inputClass} value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}
        </FilterField>
        <FilterField label="From">{(id) => <input id={id} type="date" className={inputClass} value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />}</FilterField>
        <FilterField label="To">{(id) => <input id={id} type="date" className={inputClass} value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />}</FilterField>
      </FilterBar>
      <SectionCard flush>
        {state ??
          (rows.length === 0 ? (
            <EmptyState title="No entries" />
          ) : (
            <>
              <AuditTrail items={rows} />
              <Pagination page={page} pageSize={res.data?.pageSize ?? 50} total={res.data?.total ?? null} count={rows.length} onPage={setPage} />
            </>
          ))}
      </SectionCard>
    </>
  );
}
