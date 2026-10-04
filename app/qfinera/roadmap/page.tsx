import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, NotebookPen, UserCircle } from "lucide-react";
import QFineraPage from "@/components/qfinance/QFineraPage";

export const metadata: Metadata = {
  title: "What's next",
  description: "Features under development for QFinera. Nothing here is available yet.",
  alternates: { canonical: "/qfinera/roadmap" },
};

// Only genuinely planned work recorded in the product notes. Kept apart from
// the main product pages so future features are never mistaken for current ones.
const NEXT = [
  {
    icon: Briefcase,
    title: "Personal portfolio",
    body: "Your own holdings in one place, separate from any pool, with the same honest, dated prices.",
  },
  {
    icon: NotebookPen,
    title: "Research journal",
    body: "Turn notes into an organized thesis: evidence, reasoning and a conclusion you can revisit later.",
  },
  {
    icon: UserCircle,
    title: "Member profiles",
    body: "A simple profile showing what a member has shared and contributed across QFinera.",
  },
];

export default function RoadmapPage() {
  return (
    <QFineraPage
      width="narrow"
      eyebrow="What's next"
      title="Under development"
      description="These are planned, not available. Plans can change, and we won't present any of this as ready until it is."
    >
      <ul className="space-y-3">
        {NEXT.map((n) => (
          <li key={n.title} className="flex items-start gap-4 rounded-xl border border-dashed border-[var(--qf-line)] p-5">
            <n.icon size={22} className="mt-0.5 shrink-0 text-[var(--qf-ink-soft)]" aria-hidden="true" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-[18px] font-semibold text-[var(--qf-ink)]">{n.title}</h2>
                <span className="rounded-full border border-[var(--qf-line)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--qf-ink-soft)]">Under development</span>
              </div>
              <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--qf-ink-soft)]">{n.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-[14.5px] leading-relaxed text-[var(--qf-ink-soft)]">
        Have an idea or a need we should know about? Tell us in{" "}
        <Link href="/qfinera/community" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
          Community
        </Link>
        . In the meantime,{" "}
        <Link href="/qfinera/about" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
          here is what QFinera does today
        </Link>
        .
      </p>
    </QFineraPage>
  );
}
