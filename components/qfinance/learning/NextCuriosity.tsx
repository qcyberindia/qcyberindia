import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NextCuriosity({
  prompt,
  cta,
  href,
}: {
  prompt: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="rounded-sm border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/[0.06] p-4">
      <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--qf-brass-dark)]">
        Now you&apos;re probably wondering
      </p>
      <p className="mt-1.5 font-display text-[15px] font-medium text-[var(--qf-ink)]">&ldquo;{prompt}&rdquo;</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1.5 font-display text-sm font-semibold text-[var(--qf-brass-dark)] hover:underline"
      >
        {cta}
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
