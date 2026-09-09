// Typed content module for the Beginner Journey (Section 51). Keeps chapter
// metadata out of JSX so the Journey Map and per-chapter nav can be generated
// from one source, without pulling in a CMS.

export type ChapterId =
  | "safety"
  | "market"
  | "accounts"
  | "costs"
  | "risk"
  | "what-to-buy"
  | "practice"
  | "next-step";

export type Chapter = {
  id: ChapterId;
  number: string; // "01".."08"
  slug: ChapterId; // route segment under /qfinance/learn/beginner/
  title: string;
  question: string;
  description: string;
  estMinutes: number;
  /** All eight chapters now have full content (see qfinance.md Session 14) —
   * Chapters 02–06 were already complete before that session; Chapters
   * 07–08 (the order simulator and the closing recap) were built in it. */
  ready: boolean;
};

export const chapters: Chapter[] = [
  {
    id: "safety",
    number: "01",
    slug: "safety",
    title: "Is This Safe?",
    question: "What am I actually buying?",
    description: "What a share really is, and what happens to your ownership record when the price moves.",
    estMinutes: 4,
    ready: true,
  },
  {
    id: "market",
    number: "02",
    slug: "market",
    title: "Who Runs It?",
    question: "Who am I buying from?",
    description: "Exchanges, brokers, and how your order finds a match.",
    estMinutes: 3,
    ready: true,
  },
  {
    id: "accounts",
    number: "03",
    slug: "accounts",
    title: "Where Does My Money Go?",
    question: "What's the difference between my bank and Demat account?",
    description: "Bank account, trading account, Demat account — what each one actually holds.",
    estMinutes: 3,
    ready: true,
  },
  {
    id: "costs",
    number: "04",
    slug: "costs",
    title: "What Does It Cost?",
    question: "Where did my money actually go?",
    description: "Brokerage, STT, and the other charges — and why they're not the same for every trade.",
    estMinutes: 3,
    ready: true,
  },
  {
    id: "risk",
    number: "05",
    slug: "risk",
    title: "How Do I Stay Safe?",
    question: "How do I spot a scam?",
    description: "Fake apps, guaranteed-return claims, and the habits that protect your account.",
    estMinutes: 3,
    ready: true,
  },
  {
    id: "what-to-buy",
    number: "06",
    slug: "what-to-buy",
    title: "What Should I Buy?",
    question: "Stocks, funds, ETFs — what's the difference?",
    description: "Understand the categories before you choose between them.",
    estMinutes: 4,
    ready: true,
  },
  {
    id: "practice",
    number: "07",
    slug: "practice",
    title: "Try It Safely",
    question: "Can I see this in action without risking money?",
    description: "A safe simulation of placing and tracking an order.",
    estMinutes: 5,
    ready: true,
  },
  {
    id: "next-step",
    number: "08",
    slug: "next-step",
    title: "What's My Next Step?",
    question: "What do I explore next?",
    description: "Pick a direction based on what you're curious about now.",
    estMinutes: 2,
    ready: true,
  },
];

export function getChapter(slug: string): Chapter | undefined {
  return chapters.find((c) => c.slug === slug);
}

export function getAdjacentChapters(slug: string): { prev: Chapter | null; next: Chapter | null } {
  const i = chapters.findIndex((c) => c.slug === slug);
  return {
    prev: i > 0 ? chapters[i - 1] : null,
    next: i >= 0 && i < chapters.length - 1 ? chapters[i + 1] : null,
  };
}
