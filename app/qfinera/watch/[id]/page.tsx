import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import QFineraPage from "@/components/qfinance/QFineraPage";
import SignInPrompt from "@/components/qfinance/SignInPrompt";
import { WatchDetail } from "@/components/watch/WatchDetail";
import { getServerSession } from "@/lib/qfinera-auth/http";

export const metadata: Metadata = { title: "Global Watch", robots: { index: false } };

export default async function WatchItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const session = await getServerSession();
  return (
    <QFineraPage>
      {session ? (
        <Suspense>
          <WatchDetail id={Number(id)} />
        </Suspense>
      ) : (
        <SignInPrompt next={`/qfinera/watch/${id}`}>Sign in to read this Global Watch item.</SignInPrompt>
      )}
    </QFineraPage>
  );
}
