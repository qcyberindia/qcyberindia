import type { Metadata } from "next";
import { Suspense } from "react";
import QFineraPage from "@/components/qfinance/QFineraPage";
import SignInPrompt from "@/components/qfinance/SignInPrompt";
import { LoadingSkeleton } from "@/components/fund/parts";
import { WatchFeed } from "@/components/watch/WatchFeed";
import { getServerSession } from "@/lib/qfinera-auth/http";

export const metadata: Metadata = {
  title: "Global Watch",
  description: "Useful findings shared by QFinera members: announcements, research, risks, opportunities and regulatory news.",
};

export default async function WatchPage() {
  const session = await getServerSession();
  return (
    <QFineraPage
      eyebrow="Global Watch"
      title="What members are watching"
      description="One member finds something useful, shares it here, and everyone can read it, follow the source and discuss it."
    >
      {session ? (
        <Suspense fallback={<LoadingSkeleton label="Loading Global Watch" />}>
          <WatchFeed />
        </Suspense>
      ) : (
        <SignInPrompt next="/qfinera/watch">
          <p className="font-display text-[20px] font-semibold text-[var(--qf-ink)]">Sign in to see Global Watch</p>
          <p className="mt-2">
            Company announcements, useful research, industry and economy developments, risks and regulatory news, shared by QFinera members for each other.
          </p>
        </SignInPrompt>
      )}
    </QFineraPage>
  );
}
