// Server-side gate for every page of one pool: session -> membership of THIS
// pool -> render. A pool the visitor does not belong to looks exactly like a
// pool that does not exist. Permissions handed to the client only decide what
// is SHOWN; the API authorizes every request again.
import Link from "next/link";
import { PoolsChrome, SignInGate } from "@/components/fund/PoolsChrome";
import { FundShell } from "@/components/fund/shell";
import { FundSessionProvider, type FundSession } from "@/components/fund/session";
import { NoticeProvider } from "@/components/fund/notices";
import { EmptyState, SectionCard } from "@/components/fund/parts";
import type { UiPermission } from "@/components/fund/permissions";
import { UI_PERMISSIONS } from "@/components/fund/permissions";
import { loadPageContext, type PageContext } from "@/lib/fund/auth";
import { permissionsOf } from "@/lib/fund/rbac";

function Unavailable({ title, description }: { title: string; description: string }) {
  return (
    <PoolsChrome>
      <SectionCard>
        <EmptyState
          title={title}
          description={description}
          action={
            <Link href="/qfinera/pools" className="text-[14px] font-semibold text-[var(--qf-brass-dark)] underline underline-offset-2">
              Go to your pools
            </Link>
          }
        />
      </SectionCard>
    </PoolsChrome>
  );
}

export default async function PoolLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;
  const notFoundCopy = {
    title: "Pool not found",
    description: "This pool does not exist, or you are not a member of it. Pools are private and invite-only.",
  };
  if (!/^\d{1,9}$/.test(poolId)) return <Unavailable {...notFoundCopy} />;

  let state: PageContext;
  try {
    state = await loadPageContext(Number(poolId));
  } catch (err) {
    if ((err as { digest?: unknown } | null)?.digest) throw err;
    console.error("QFinera Pools: could not load the pool context:", err);
    return <Unavailable title="Pools are not available right now" description="Please try again in a few minutes." />;
  }

  if (state.state === "unauthenticated") {
    return (
      <PoolsChrome>
        <SignInGate message="Sign in to open this pool." next={`/qfinera/pools/${poolId}/dashboard`} />
      </PoolsChrome>
    );
  }
  if (state.state === "no-membership") return <Unavailable {...notFoundCopy} />;
  if (state.state === "suspended") {
    return <Unavailable title="Your membership is suspended" description="Contact the pool administrator to restore access." />;
  }

  const { ctx } = state;
  const granted = new Set(permissionsOf(ctx.actor));
  const session: FundSession = {
    userId: ctx.userId,
    displayName: ctx.displayName,
    role: ctx.actor.role,
    poolId: ctx.fund.id,
    poolName: ctx.fund.name,
    poolStatus: ctx.fund.status,
    pools: ctx.funds,
    permissions: UI_PERMISSIONS.filter((p): p is UiPermission => granted.has(p)),
  };

  return (
    <FundSessionProvider value={session}>
      <NoticeProvider>
        <FundShell>{children}</FundShell>
      </NoticeProvider>
    </FundSessionProvider>
  );
}
