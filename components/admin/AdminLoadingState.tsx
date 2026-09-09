import { RefreshCw } from "lucide-react";

export default function AdminLoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 px-4 py-16 text-sm text-[var(--color-fog)]">
      <RefreshCw size={15} className="animate-spin text-[var(--color-navy)]" />
      {label}
    </div>
  );
}
