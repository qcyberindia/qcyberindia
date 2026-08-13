"use client";

import Image from "next/image";

type Story = {
  id: string;
  tab: string;
  eyebrow: string;
  userLine: string;
  qbidsLine: string;
  image: string;
  alt: string;
};

const stories: Story[] = [
  {
    id: "discover",
    tab: "Discover",
    eyebrow: "01 — Discover opportunities",
    userLine: "“What's worth looking at today?”",
    qbidsLine: "Start your day with a centralized view of available tenders.",
    image: "/qbids/dashboard.png",
    alt: "Qbids dashboard showing today's tenders",
  },
  {
    id: "search",
    tab: "Search",
    eyebrow: "02 — Search exactly what you need",
    userLine: "“I need tenders in Tamil Nadu closing soon.”",
    qbidsLine: "Filter by keyword, category, state, city, source, and closing date.",
    image: "/qbids/search.png",
    alt: "Qbids search and filter screen",
  },
  {
    id: "save",
    tab: "Save",
    eyebrow: "03 — Save the search, not just the tender",
    userLine: "“I search for this same kind of tender every week.”",
    qbidsLine:
      "Save the filter combination once, then re-run it any time — straight into Watch, Bid, No-Bid, or Compare.",
    image: "/qbids/saved-search.png",
    alt: "Qbids saved searches screen showing a saved filter re-run with results",
  },
  {
    id: "watch",
    tab: "Watch",
    eyebrow: "04 — Watch important opportunities",
    userLine: "“I don't want to lose track of this one.”",
    qbidsLine: "Add it to your Watchlist and keep it in view.",
    image: "/qbids/watchlist.png",
    alt: "Qbids watchlist screen",
  },
  {
    id: "compare",
    tab: "Compare",
    eyebrow: "05 — Compare opportunities",
    userLine: "“I found three tenders. Which one is better?”",
    qbidsLine: "Compare up to four tenders side by side — department, value, EMD, dates, all in one table.",
    image: "/qbids/compare.png",
    alt: "Qbids tender comparison table",
  },
  {
    id: "prepare",
    tab: "Prepare",
    eyebrow: "06 — Turn a tender into a bid",
    userLine: "“Okay, we're bidding on this one.”",
    qbidsLine: "Save it and it becomes a bid you can start working on.",
    image: "/qbids/my-bids.png",
    alt: "Qbids My Bids screen",
  },
  {
    id: "manage",
    tab: "Manage",
    eyebrow: "07 — Manage the bid workspace",
    userLine: "“What documents and work are still pending?”",
    qbidsLine: "Checklist, documents, team, and tasks — tracked in one workspace.",
    image: "/qbids/bid-workspace.png",
    alt: "Qbids bid workspace with checklist, documents, and tasks",
  },
  {
    id: "reuse",
    tab: "Reuse",
    eyebrow: "08 — Reuse your documents",
    userLine: "“I don't want to re-upload our GST certificate every time.”",
    qbidsLine: "Keep company documents in one repository and attach them to any bid.",
    image: "/qbids/document-repository.png",
    alt: "Qbids document repository screen",
  },
];

export default function QbidsShowcase() {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      {/* Sticky tab nav */}
      <div className="sticky top-0 z-10 -mx-6 border-y border-[#1e2a38] bg-[#0a0e13]/95 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto sm:justify-center">
          {stories.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm text-[#8aa0b4] transition-colors hover:bg-[#111823] hover:text-[#3fd0c9]"
            >
              {s.tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6">
        {stories.map((s, i) => (
          <section
            key={s.id}
            id={s.id}
            className={`scroll-mt-20 py-16 ${i !== stories.length - 1 ? "border-b border-[#1e2a38]" : ""}`}
          >
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[#3fd0c9]">{s.eyebrow}</p>
            <p className="mt-3 text-[#8aa0b4]">{s.userLine}</p>
            <p className="mt-1 text-xl font-semibold text-[#e6edf3]">{s.qbidsLine}</p>

            <div className="mt-6 overflow-hidden rounded-xl border border-[#1e2a38] shadow-2xl shadow-black/40">
              <Image
                src={s.image}
                alt={s.alt}
                width={2048}
                height={1185}
                className="h-auto w-full"
                sizes="(min-width: 768px) 800px, 100vw"
                quality={82}
                priority={i === 0}
                loading={i === 0 ? undefined : "lazy"}
              />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
