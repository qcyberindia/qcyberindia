import type { NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { requireActiveSession } from "@/lib/fund/auth";
import { notFoundError, toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, jsonOk } from "@/lib/fund/http";
import { restorePool } from "@/lib/fund/services/pool-deletion";
import type { PoolParams } from "@/lib/fund/pool-http";

/**
 * ADMIN of a pool scheduled for deletion: restore it before the purge.
 * Deleted pools are unreachable through poolRoute(), so this checks the
 * caller's ADMIN membership itself (restorePool); anyone else gets 404.
 */
export async function POST(req: NextRequest, { params }: PoolParams) {
  try {
    assertJsonMutation(req);
    const session = await requireActiveSession(req);
    const { poolId } = await params;
    if (!/^\d{1,9}$/.test(poolId)) throw notFoundError("Pool");
    const pool = await restorePool({ userId: session.userId, meta: requestMeta(req) }, Number(poolId));
    return jsonOk({ pool });
  } catch (err) {
    return toErrorResponse(err);
  }
}
