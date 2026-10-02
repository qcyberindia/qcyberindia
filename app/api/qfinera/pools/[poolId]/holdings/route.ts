import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { getHoldings } from "@/lib/fund/queries";
import { assertPermission } from "@/lib/fund/rbac";

/** Positions from accounting trades; prices from the market-data provider, labelled by quality. */
export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ ctx }) => {
    assertPermission(ctx.actor, "holdings:view");
    return jsonOk(await getHoldings(readDb(), ctx.fund.id));
  });
}
