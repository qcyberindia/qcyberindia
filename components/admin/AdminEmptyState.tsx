import { Inbox, LucideIcon } from "lucide-react";

export default function AdminEmptyState({ label, icon: Icon = Inbox }: { label: string; icon?: LucideIcon }) {
  return (
    <div className="px-4 py-16 text-center text-[var(--color-fog)]">
      <Icon size={22} className="mx-auto mb-2 text-[var(--color-line)]" />
      {label}
    </div>
  );
}
