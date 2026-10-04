import type { Metadata } from "next";
import QFineraPage from "@/components/qfinance/QFineraPage";
import SignInPrompt from "@/components/qfinance/SignInPrompt";
import { WatchRequests } from "@/components/watch/WatchRequests";
import { getServerSession } from "@/lib/qfinera-auth/http";

export const metadata: Metadata = { title: "Global Watch moderation", robots: { index: false } };

export default async function WatchRequestsPage() {
  const session = await getServerSession();
  return (
    <QFineraPage
      width="narrow"
      eyebrow="Global Watch"
      title="Moderation requests"
      description="Edits and deletions a moderator proposed for someone else's item. They apply only when an administrator approves."
    >
      {session ? <WatchRequests /> : <SignInPrompt next="/qfinera/watch/requests">Sign in to continue.</SignInPrompt>}
    </QFineraPage>
  );
}
