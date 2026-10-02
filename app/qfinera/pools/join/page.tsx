import type { Metadata } from "next";
import { PoolsChrome, SignInGate } from "@/components/fund/PoolsChrome";
import { JoinInvite, JoinWithLink } from "@/components/fund/views/JoinInvite";
import { getQFinanceServerSession } from "@/lib/qfinance-community-auth";

export const metadata: Metadata = { title: "Join a pool" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  const session = await getQFinanceServerSession();
  return (
    <PoolsChrome>
      {!session ? (
        <SignInGate
          message="You've been invited to a private pool. Sign in with the email address the invitation was sent to and you'll come straight back here. New to QFinera? Create your account with that email, confirm it, then open the invitation link again."
          next={`/qfinera/pools/join?token=${encodeURIComponent(token)}`}
        />
      ) : !token ? (
        <JoinWithLink />
      ) : (
        <JoinInvite token={token} email={session.email} />
      )}
    </PoolsChrome>
  );
}
