import { LucideIcon, MessageCircleQuestion } from "lucide-react";

/** Shared empty state for QFinera — used anywhere a list can legitimately
 * have zero real items (community feed, homepage feed preview). Exists so
 * empty states look and read consistently instead of each page hand-rolling
 * its own markup; never used to paper over a loading/error condition. */
export default function EmptyState({
  icon: Icon = MessageCircleQuestion,
  title,
  description,
  dashed = true,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  dashed?: boolean;
}) {
  return (
    <div
      className={`rounded-md p-10 text-center ${
        dashed ? "border border-dashed border-[var(--qf-line)]" : "border border-[var(--qf-line)]"
      }`}
    >
      <Icon size={28} className="mx-auto text-[var(--qf-ink-soft)]" />
      <p className="mt-3 font-display text-lg font-semibold text-[var(--qf-ink)]">{title}</p>
      {description && <p className="mt-1.5 text-[14px] text-[var(--qf-ink-soft)]">{description}</p>}
    </div>
  );
}
