import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { assertPermission, canPropose, hasPermission } from "@/lib/fund/rbac";
import { navStatus } from "@/lib/fund/services/nav";

/**
 * Every member: where the official NAV stands and which dates requests are
 * waiting for (counts only). ADMIN/MANAGER also get what blocks the next strike.
 */
export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ ctx }) => {
    assertPermission(ctx.actor, "nav:view");
    const canStrike = hasPermission(ctx.actor, "nav:finalize") || canPropose(ctx.actor, "nav:finalize");
    return jsonOk({ status: await navStatus(readDb(), ctx.fund.id, { userId: ctx.actor.userId, canStrike }) });
  });
}
