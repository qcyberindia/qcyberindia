import type { NextRequest } from "next/server";
import { actionResponse } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { actOrPropose } from "@/lib/fund/services/change-requests";
import { readJsonObject } from "@/lib/fund/validation";

/**
 * ADMIN: schedule the pool for deletion. Body: { confirmName, reason? };
 * confirmName must equal the pool's name. The pool becomes inaccessible at
 * once and is purged after the 30-day retention period unless restored.
 * A MANAGER's request waits for ADMIN approval.
 */
export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => actionResponse(await actOrPropose(sctx, "pool.delete", null, await readJsonObject(req))),
    { mutation: true }
  );
}
