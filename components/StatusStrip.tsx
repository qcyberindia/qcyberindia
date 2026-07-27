import { statusMetrics } from "@/lib/site-config";

export default function StatusStrip() {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white shadow-sm px-6 py-4 flex flex-wrap items-center gap-x-10 gap-y-3 text-sm">
      {statusMetrics.map((m) => (
        <div key={m.label} className="flex items-center gap-2.5">
          <span className="status-dot h-2 w-2 rounded-full bg-[var(--color-gold)]" />
          <span className="text-[var(--color-fog)]">{m.label}</span>
          <span className="text-[var(--color-navy)] font-semibold">{m.value}</span>
        </div>
      ))}
    </div>
  );
}
