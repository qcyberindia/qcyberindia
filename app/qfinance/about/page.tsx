import type { Metadata } from "next";
import ComingSoon from "@/components/qfinance/ComingSoon";

export const metadata: Metadata = {
  title: "About",
  description: "About QFinance - coming soon.",
  alternates: { canonical: "/qfinance/about" },
};

export default function AboutPage() {
  return (
    <ComingSoon
      eyebrow="Coming soon"
      title="About QFinance"
      description="The full story of why QFinance exists is still being written. For now: understand first, invest second - that's the whole idea."
      backHref="/qfinance"
      backLabel="Back to QFinance"
    />
  );
}
