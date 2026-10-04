import type { Metadata } from "next";
import QFineraPage from "@/components/qfinance/QFineraPage";
import SignInPrompt from "@/components/qfinance/SignInPrompt";
import { WatchForm } from "@/components/watch/WatchForm";
import { getServerSession } from "@/lib/qfinera-auth/http";

export const metadata: Metadata = { title: "Share on Global Watch", robots: { index: false } };

export default async function NewWatchPage() {
  const session = await getServerSession();
  return (
    <QFineraPage width="narrow" eyebrow="Global Watch" title="Share something useful" description="A title, a few lines on why it matters, and the source. That's enough.">
      {session ? <WatchForm /> : <SignInPrompt next="/qfinera/watch/new">Sign in to share on Global Watch.</SignInPrompt>}
    </QFineraPage>
  );
}
