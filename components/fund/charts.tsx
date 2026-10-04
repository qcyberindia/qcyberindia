"use client";

// Small, dependency-free SVG charts for pool dashboards. Display only: the
// figures come from official NAV snapshots and the ledger (server-side),
// and are parsed to numbers here purely for geometry; every value shown in
// text is formatted from the original decimal string.
//
// Conventions: one y-axis, recessive grid, 2px lines, 4px rounded bar ends,
// a 2px gap between adjacent bars, a legend for 2+ series, a hover/focus
// tooltip, and a "Show as table" alternative for every chart.
import { useId, useMemo, useRef, useState } from "react";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

export function formatInr(value: string | number, compact = false): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return (compact ? inrCompact : inr).format(n);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "Nice" axis ticks covering [min, max]. */
function ticks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

function ChartTable({ caption, head, rows }: { caption: string; head: string[]; rows: string[][] }) {
  return (
    <details className="mt-3 text-[12.5px]">
      <summary className="cursor-pointer select-none text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]">Show as table</summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-md border border-[var(--qf-line)]">
        <table className="w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-[var(--qf-cream-1)]">
            <tr>
              {head.map((h, i) => (
                <th key={h} scope="col" className={`px-3 py-1.5 font-semibold text-[var(--qf-ink-soft)] ${i === 0 ? "text-left" : "text-right"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[0]} className="border-t border-[var(--qf-line)]/60">
                {r.map((c, i) => (
                  <td key={i} className={`px-3 py-1.5 tabular-nums ${i === 0 ? "text-left" : "text-right"}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function Legend({ items }: { items: ReadonlyArray<{ label: string; color: string }> }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--qf-ink-soft)]">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 26, left: 56 };

/** Single-series line over time, with a crosshair tooltip (pointer and keyboard). */
export function LineChart({
  points,
  caption,
  valueLabel,
  format,
  axisFormat = format,
}: {
  points: ReadonlyArray<{ x: string; y: string }>;
  caption: string;
  valueLabel: string;
  format: (v: string) => string;
  axisFormat?: (v: string) => string;
}) {
  const id = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const geo = useMemo(() => {
    const ys = points.map((p) => Number(p.y));
    const t = ticks(Math.min(...ys), Math.max(...ys));
    const lo = t[0];
    const hi = t[t.length - 1];
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const x = (i: number) => PAD.left + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    const y = (v: number) => PAD.top + ih - ((v - lo) / (hi - lo || 1)) * ih;
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(Number(p.y)).toFixed(1)}`).join("");
    const area = `${line}L${x(points.length - 1).toFixed(1)},${PAD.top + ih}L${x(0).toFixed(1)},${PAD.top + ih}Z`;
    return { t, x, y, line, area, ih };
  }, [points]);

  if (points.length === 0) return null;
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  const a = active === null ? null : points[active];

  function pick(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const sx = ((clientX - box.left) / box.width) * W;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(geo.x(i) - sx) < Math.abs(geo.x(best) - sx)) best = i;
    setActive(best);
  }

  return (
    <figure className="m-0">
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-[var(--qf-brass)]"
          role="img"
          aria-labelledby={`${id}-cap`}
          tabIndex={0}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setActive((v) => Math.max(0, (v ?? points.length) - 1));
            if (e.key === "ArrowRight") setActive((v) => Math.min(points.length - 1, (v ?? -1) + 1));
          }}
        >
          {geo.t.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={geo.y(v)} y2={geo.y(v)} stroke="var(--qf-line)" strokeOpacity={0.6} strokeDasharray="2 4" />
              <text x={PAD.left - 8} y={geo.y(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--qf-ink-soft)">
                {axisFormat(String(v))}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text key={p.x} x={geo.x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--qf-ink-soft)">
                {dayLabel(p.x)}
              </text>
            ) : null
          )}
          <path d={geo.area} fill="var(--qf-chart-1)" fillOpacity={0.08} />
          <path d={geo.line} fill="none" stroke="var(--qf-chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.length === 1 && <circle cx={geo.x(0)} cy={geo.y(Number(points[0].y))} r={4} fill="var(--qf-chart-1)" />}
          {a && active !== null && (
            <g>
              <line x1={geo.x(active)} x2={geo.x(active)} y1={PAD.top} y2={PAD.top + geo.ih} stroke="var(--qf-ink-soft)" strokeOpacity={0.5} />
              <circle cx={geo.x(active)} cy={geo.y(Number(a.y))} r={5} fill="var(--qf-chart-1)" stroke="var(--qf-cream-0)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {a && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-2.5 py-1.5 text-[12px] shadow-sm"
            style={{ left: `${(geo.x(active) / W) * 100}%`, transform: `translateX(${geo.x(active) > W * 0.6 ? "-105%" : "5%"})` }}
          >
            <p className="text-[var(--qf-ink-soft)]">{dayLabel(a.x)}</p>
            <p className="font-semibold tabular-nums text-[var(--qf-ink)]">{format(a.y)}</p>
          </div>
        )}
      </div>
      <figcaption id={`${id}-cap`} className="sr-only">
        {caption}
      </figcaption>
      <ChartTable caption={caption} head={["Date", valueLabel]} rows={points.map((p) => [p.x, format(p.y)])} />
    </figure>
  );
}

/** Two series side by side per period (e.g. contributions vs withdrawals). */
export function PairedBars({
  rows,
  series,
  caption,
  format,
}: {
  rows: ReadonlyArray<{ label: string; values: [string, string] }>;
  series: [{ label: string; color: string }, { label: string; color: string }];
  caption: string;
  format: (v: string) => string;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...rows.flatMap((r) => r.values.map(Number)));
  const t = ticks(0, max);
  const top = t[t.length - 1];
  const iw = W - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const band = iw / Math.max(rows.length, 1);
  const barW = Math.min(22, (band - 10) / 2);
  const y = (v: number) => PAD.top + ih - (v / top) * ih;
  const a = active === null ? null : rows[active];

  return (
    <figure className="m-0">
      <Legend items={series} />
      <div className="relative mt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={`${id}-cap`} onPointerLeave={() => setActive(null)}>
          {t.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--qf-line)" strokeOpacity={0.6} strokeDasharray={v === 0 ? undefined : "2 4"} />
              <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--qf-ink-soft)">
                {formatInr(v, true)}
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const cx = PAD.left + band * i + band / 2;
            return (
              <g key={r.label}>
                {r.values.map((v, k) => {
                  const h = Math.max(0, y(0) - y(Number(v)));
                  const x = k === 0 ? cx - barW - 1 : cx + 1;
                  return h > 0 ? (
                    <path
                      key={k}
                      d={`M${x},${y(0)}V${y(0) - h + Math.min(4, h)}q0,-${Math.min(4, h)} ${Math.min(4, barW / 2)},-${Math.min(4, h)}H${x + barW - Math.min(4, barW / 2)}q${Math.min(4, barW / 2)},0 ${Math.min(4, barW / 2)},${Math.min(4, h)}V${y(0)}Z`}
                      fill={series[k].color}
                      opacity={active === null || active === i ? 1 : 0.45}
                    />
                  ) : null;
                })}
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--qf-ink-soft)">
                  {r.label}
                </text>
                {/* Hit target wider than the bars. */}
                <rect
                  x={cx - band / 2}
                  y={PAD.top}
                  width={band}
                  height={ih}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${r.label}: ${series[0].label} ${format(r.values[0])}, ${series[1].label} ${format(r.values[1])}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="outline-none"
                />
              </g>
            );
          })}
        </svg>
        {a && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-2.5 py-1.5 text-[12px] shadow-sm"
            style={{
              left: `${((PAD.left + band * active + band / 2) / W) * 100}%`,
              transform: `translateX(${active > rows.length / 2 ? "-105%" : "5%"})`,
            }}
          >
            <p className="text-[var(--qf-ink-soft)]">{a.label}</p>
            {series.map((s, k) => (
              <p key={s.label} className="flex items-center gap-1.5 tabular-nums text-[var(--qf-ink)]">
                <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}: <span className="font-semibold">{format(a.values[k])}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <figcaption id={`${id}-cap`} className="sr-only">
        {caption}
      </figcaption>
      <ChartTable caption={caption} head={["Period", series[0].label, series[1].label]} rows={rows.map((r) => [r.label, format(r.values[0]), format(r.values[1])])} />
    </figure>
  );
}

/** Ranked horizontal bars with values in text (allocation, concentration). One hue: magnitude. */
export function BarList({ rows, caption }: { rows: ReadonlyArray<{ label: string; value: number; display: string; note?: string }>; caption: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <figure className="m-0">
      <ul className="space-y-2.5" aria-label={caption}>
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate font-medium text-[var(--qf-ink)]">{r.label}</span>
              <span className="shrink-0 tabular-nums text-[var(--qf-ink-soft)]">
                {r.display}
                {r.note && <span className="ml-1.5 text-[var(--qf-ink)]">{r.note}</span>}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--qf-cream-2)]/70">
              <div className="h-full rounded-full bg-[var(--qf-chart-1)]" style={{ width: `${max > 0 ? Math.max(1.5, (r.value / max) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** One stacked bar for a part-to-whole of two parts (e.g. cash vs invested). */
export function SplitBar({ parts, caption }: { parts: [{ label: string; value: number; display: string }, { label: string; value: number; display: string }]; caption: string }) {
  const total = parts[0].value + parts[1].value;
  const colors = ["var(--qf-chart-1)", "var(--qf-chart-2)"];
  return (
    <figure className="m-0">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${caption}: ${parts.map((p) => `${p.label} ${p.display}`).join(", ")}`}>
        {total > 0 ? (
          parts.map((p, i) =>
            p.value > 0 ? <div key={p.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.value / total) * 100}%`, background: colors[i] }} /> : null
          )
        ) : (
          <div className="h-full w-full bg-[var(--qf-cream-2)]" />
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
        {parts.map((p, i) => (
          <div key={p.label}>
            <dt className="flex items-center gap-1.5 text-[var(--qf-ink-soft)]">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[i] }} />
              {p.label}
            </dt>
            <dd className="mt-0.5 font-display text-[17px] font-semibold tabular-nums text-[var(--qf-ink)]">
              {p.display}
              {total > 0 && <span className="ml-1.5 text-[12.5px] font-normal text-[var(--qf-ink-soft)]">{Math.round((p.value / total) * 100)}%</span>}
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

/** Honest placeholder when there is not enough history to chart. */
export function NotEnoughData({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-[var(--qf-line)] px-6 py-8 text-center text-[13px] leading-relaxed text-[var(--qf-ink-soft)]">
      {children}
    </div>
  );
}
