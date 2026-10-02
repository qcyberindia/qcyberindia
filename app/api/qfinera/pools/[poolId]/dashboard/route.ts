import type { NextRequest } from "next/server";
import { assertPermission } from "@/lib/fund/rbac";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { getDashboard } from "@/lib/fund/queries";

export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ ctx }) => {
    assertPermission(ctx.actor, "fund:view");
    return jsonOk(await getDashboard(readDb(), ctx));
  });
}
