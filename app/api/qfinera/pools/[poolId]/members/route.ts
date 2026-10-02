import type { NextRequest } from "next/server";
import { assertPermission, hasPermission } from "@/lib/fund/rbac";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { listMembers } from "@/lib/fund/queries";

/** Privileged roles see every member; a MEMBER sees only their own row. */
export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, ctx }) => {
    assertPermission(ctx.actor, "members:view_self");
    const includeRemoved = req.nextUrl.searchParams.get("removed") === "1" && hasPermission(ctx.actor, "members:view_all");
    return jsonOk({ members: await listMembers(readDb(), ctx, { includeRemoved }) });
  });
}
