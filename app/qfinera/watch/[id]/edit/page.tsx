import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QFineraPage from "@/components/qfinance/QFineraPage";
import SignInPrompt from "@/components/qfinance/SignInPrompt";
import { WatchEdit } from "@/components/watch/WatchEdit";
import { getServerSession } from "@/lib/qfinera-auth/http";

export const metadata: Metadata = { title: "Edit Global Watch item", robots: { index: false } };

export default async function EditWatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const session = await getServerSession();
  return (
    <QFineraPage width="narrow" eyebrow="Global Watch" title="Edit item">
      {session ? <WatchEdit id={Number(id)} /> : <SignInPrompt next={`/qfinera/watch/${id}/edit`}>Sign in to edit.</SignInPrompt>}
    </QFineraPage>
  );
}
