import type { NextRequest } from "next/server";
import { actionResponse } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { actOrPropose } from "@/lib/fund/services/change-requests";
import { readJsonObject } from "@/lib/fund/validation";

/**
 * ADMIN: change role (VIEWER / MEMBER / MANAGER / ADMIN), suspend/reactivate,
 * or remove (id = the member's user id). A MANAGER's change becomes a request
 * for ADMIN approval. Body: { role?, status?, reason? }.
 */
export async function PATCH(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      // joinRequestId is set only by the join-request workflow, never by a caller.
      delete body.joinRequestId;
      return actionResponse(await actOrPropose(sctx, "member.update", itemId(id), body));
    },
    { mutation: true }
  );
}
