import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { permissionsOf } from "@/lib/fund/rbac";

/** The caller's context in this pool: the pool, their role and permissions. */
export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ ctx }) =>
    jsonOk({
      pool: ctx.fund,
      role: ctx.actor.role,
      permissions: permissionsOf(ctx.actor),
      user: { id: ctx.userId, displayName: ctx.displayName },
    })
  );
}
