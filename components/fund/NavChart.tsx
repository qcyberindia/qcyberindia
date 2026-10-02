"use client";

import { useId, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { NavSnapshot } from "@/components/fund/api";
import { DateDisplay, MoneyDisplay } from "@/components/fund/display";
import { EmptyState, LoadingSkeleton } from "@/components/fund/parts";
import { usePoolResource } from "@/components/fund/useResource";

// Official NAV per unit over time, from the existing NAV-history report.
// Display only: values are parsed to numbers solely to place points; every
// figure shown as text is the server's own decimal string.

const W = 640;
const H = 200;
const PAD = { top: 16, right: 12, bottom: 24, left: 12 };

export function NavChart() {
  const res = usePoolResource<{ rows: NavSnapshot[] }>("reports", { type: "nav-history" });
  const [hover, setHover] = useState<number | null>(null);
  const gradId = `nav-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const points = useMemo(() => {
    const rows = (res.data?.rows ?? []).filter((r) => r.isOfficial).slice().reverse();
    if (rows.length === 0) return [];
    const values = rows.map((r) => Number(r.nav));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || Math.abs(max) * 0.01 || 1;
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    return rows.map((r, i) => ({
      row: r,
      x: PAD.left + (rows.length === 1 ? innerW / 2 : (i / (rows.length - 1)) * innerW),
      y: PAD.top + innerH - ((values[i] - min) / span) * innerH,
    }));
  }, [res.data]);

  if (res.loading) return <LoadingSkeleton rows={3} label="Loading NAV history" />;
  if (res.error) return <EmptyState icon={TrendingUp} title="NAV history is unavailable" description={res.error.message} />;
  if (points.length < 2) {
    return (
      <EmptyState
        icon={TrendingUp}
        title={points.length === 0 ? "No official NAV yet" : "One official NAV so far"}
        description="The chart appears once the pool administrator has struck at least two end-of-day NAVs."
      />
    );
  }

  const line = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${H - PAD.bottom} L${points[0].x.toFixed(1)},${H - PAD.bottom} Z`;
  const active = hover === null ? points[points.length - 1] : points[hover];
  const first = points[0].row;
  const last = points[points.length - 1].row;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].x - x) < Math.abs(points[best].x - x)) best = i;
    setHover(best);
  }

  return (
    <div className="px-4 pb-4 pt-3 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2" aria-live="polite">
        <p className="font-display text-[22px] font-semibold tracking-tight text-[var(--qf-ink)]">
          <MoneyDisplay value={active.row.nav} dp={4} />
        </p>
        <p className="text-[12.5px] text-[var(--qf-ink-soft)]">
          {hover === null ? "Latest official NAV, " : ""}
          <DateDisplay value={active.row.asOfDate} />
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 h-44 w-full touch-none sm:h-52"
        role="img"
        aria-label={`Official NAV per unit from ${first.asOfDate} (${first.nav}) to ${last.asOfDate} (${last.nav}), ${points.length} snapshots.`}
        preserveAspectRatio="none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--qf-brass)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--qf-brass)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => {
          const y = PAD.top + t * (H - PAD.top - PAD.bottom);
          return <line key={t} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="var(--qf-line)" strokeOpacity="0.6" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />;
        })}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke="var(--qf-brass)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover !== null && (
          <line x1={active.x} x2={active.x} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--qf-ink-soft)" strokeOpacity="0.5" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {/* The dot is HTML so it stays round when the SVG stretches. */}
      <div className="relative -mt-44 h-44 sm:-mt-52 sm:h-52 pointer-events-none" aria-hidden="true">
        <span
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--qf-cream-0)] bg-[var(--qf-brass-dark)]"
          style={{ left: `${(active.x / W) * 100}%`, top: `${(active.y / H) * 100}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11.5px] text-[var(--qf-ink-soft)]">
        <DateDisplay value={first.asOfDate} />
        <DateDisplay value={last.asOfDate} />
      </div>
    </div>
  );
}
