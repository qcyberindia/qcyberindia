"use client";

import { useState } from "react";
import { endpoints, itemOf, type ReportDto, type ReportKey } from "@/components/fund/api";
import { DateDisplay, MoneyDisplay, PercentDisplay, QuantityDisplay } from "@/components/fund/display";
import { inputClass } from "@/components/fund/forms";
import { Disclaimer, EmptyState, PageHeader, SectionCard } from "@/components/fund/parts";
import { useCan } from "@/components/fund/session";
import { useFundResource } from "@/components/fund/useResource";
import type { UiPermission } from "@/components/fund/permissions";
import { resourceState } from "@/components/fund/common";
import { DataTable, FilterBar, FilterField, type Column } from "@/components/fund/table";

type Row = Record<string, string | number | null>;

const REPORTS: ReadonlyArray<{ key: ReportKey; label: string; permission?: UiPermission }> = [
  { key: "daily", label: "Daily report" },
  { key: "nav-history", label: "NAV history" },
  { key: "member-capital", label: "Capital" },
  { key: "contributions", label: "Contributions" },
  { key: "withdrawals", label: "Withdrawals" },
  { key: "trades", label: "Trades" },
  { key: "holdings", label: "Holdings" },
  { key: "pnl", label: "Profit and loss" },
  { key: "expenses", label: "Expenses", permission: "expenses:view" },
  { key: "cash-movement", label: "Cash movement" },
  { key: "ownership", label: "Ownership" },
  { key: "audit-activity", label: "Audit activity", permission: "audit:view" },
];

function Cell({ kind, value }: { kind: NonNullable<ReportDto["columns"][number]["kind"]>; value: string | number | null | undefined }) {
  const text = value === null || value === undefined ? null : String(value);
  switch (kind) {
    case "money":
      return <MoneyDisplay value={text} />;
    case "quantity":
      return <QuantityDisplay value={text} />;
    case "percent":
      return <PercentDisplay value={text} />;
    case "date":
      return <DateDisplay value={text} />;
    default:
      return <span>{text ?? "\u2014"}</span>;
  }
}

function ReportTable({ report }: { report: ReportDto }) {
  const columns: Column<Row>[] = report.columns.map((c, i) => ({
    key: c.key,
    header: c.label,
    primary: i === 0,
    align: c.kind === "money" || c.kind === "quantity" || c.kind === "percent" ? "right" : "left",
    cell: (row) => <Cell kind={c.kind ?? "text"} value={row[c.key]} />,
  }));
  // Reports have no natural id, so rows are keyed by their position in this (read-only) result.
  const rows: Row[] = report.rows.map((r, i) => ({ ...r, __row: i }));
  return <DataTable columns={columns} rows={rows} rowKey={(r) => String(r.__row)} caption={report.title} />;
}

export function ReportsView() {
  const can = useCan();
  const available = REPORTS.filter((r) => !r.permission || can(r.permission));
  const [key, setKey] = useState<ReportKey>("daily");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const res = useFundResource(endpoints.reports, { report: key, from, to }, (j) => itemOf<ReportDto>(j));
  const state = resourceState(res, "report");
  const report = res.data;
  const dirty = Boolean(from || to);

  return (
    <>
      <PageHeader title="Reports" description="Read-only views of the fund, as calculated by the fund." />
      <nav aria-label="Report type" className="mb-4">
        <ul className="flex flex-wrap gap-2">
          {available.map((r) => (
            <li key={r.key}>
              <button
                type="button"
                aria-pressed={key === r.key}
                onClick={() => setKey(r.key)}
                className={`min-h-10 rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)] ${
                  key === r.key
                    ? "border-[var(--qf-brass-dark)] bg-[var(--qf-brass-dark)] text-[var(--qf-cream-0)]"
                    : "border-[var(--qf-line)] text-[var(--qf-ink)] hover:border-[var(--qf-brass)]"
                }`}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <FilterBar dirty={dirty} onReset={() => { setFrom(""); setTo(""); }}>
        <FilterField label="From date">
          {(id) => <input id={id} type="date" className={inputClass} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />}
        </FilterField>
        <FilterField label="To date">
          {(id) => <input id={id} type="date" className={inputClass} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />}
        </FilterField>
      </FilterBar>
      <div className="space-y-4">
        {report?.note && <Disclaimer>{report.note}</Disclaimer>}
        <SectionCard title={report?.title ?? available.find((r) => r.key === key)?.label} flush>
          {state ?? (report && report.rows.length > 0 ? (
            <ReportTable report={report} />
          ) : (
            <EmptyState title="Nothing to report" description={dirty ? "No records fall inside these dates." : "This report has no records yet."} />
          ))}
        </SectionCard>
        {report?.disclaimer && <Disclaimer>{report.disclaimer}</Disclaimer>}
      </div>
    </>
  );
}
