import type { Metadata } from "next";

// Pools are private: never indexed, never listed publicly.
export const metadata: Metadata = {
  title: { default: "Pools", template: "%s | QFinera Pools" },
  robots: { index: false, follow: false },
};

export default function PoolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
