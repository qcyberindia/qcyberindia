import { LucideIcon } from "lucide-react";
import Link from "next/link";

export default function AdminStat({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  href?: string;
}) {
  const content = (
    <div className="card p-5 transition-colors hover:border-[var(--color-navy)]/30">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-navy)]/20 bg-[var(--color-navy)]/5">
        <Icon size={16} className="text-[var(--color-navy)]" />
      </div>
      <p className="mt-4 font-display text-2xl font-bold tabular-nums text-[var(--color-ink)]">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-fog)]">{label}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
