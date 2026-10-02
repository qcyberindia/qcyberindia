import { PoolsChrome, SignInGate } from "@/components/fund/PoolsChrome";
import { PoolsHome } from "@/components/fund/views/PoolsHome";
import { readDb } from "@/lib/fund/db";
import { pendingInvitesFor } from "@/lib/fund/services/invites";
import { listMyPools } from "@/lib/fund/services/pools";
import { getQFinanceServerSession } from "@/lib/qfinance-community-auth";

export default async function PoolsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const session = await getQFinanceServerSession();
  if (!session) {
    return (
      <PoolsChrome>
        <SignInGate message="Create a pool for people you know, invite them by email, and keep one shared, accurate record of what the group puts in, trades and owns." />
      </PoolsChrome>
    );
  }
  let data;
  try {
    const db = readDb();
    data = await Promise.all([listMyPools(db, session.userId), pendingInvitesFor(db, session.email)]);
  } catch (err) {
    console.error("QFinera Pools: could not load pools:", err);
    return (
      <PoolsChrome>
        <p role="alert" className="rounded-lg border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-4 py-3 text-[14px]">
          Pools are not available right now. Please try again in a few minutes.
        </p>
      </PoolsChrome>
    );
  }
  const [pools, invites] = data;
  return (
    <PoolsChrome>
      <PoolsHome pools={pools} invites={invites} welcome={(await searchParams).welcome === "1"} />
    </PoolsChrome>
  );
}
