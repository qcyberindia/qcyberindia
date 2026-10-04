import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { reviewJoinRequest, withdrawJoinRequest } from "@/lib/fund/services/join-requests";
import { parseEnum, parseOptionalText, readJsonObject } from "@/lib/fund/validation";

/**
 * MANAGER/ADMIN: approve or reject (a MANAGER's approval waits for an ADMIN).
 * The requester: withdraw.
 */
export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      const jid = itemId(id);
      const action = parseEnum(body.action, "action", ["approve", "reject", "withdraw"] as const);
      if (action === "withdraw") return jsonOk({ joinRequest: await withdrawJoinRequest(sctx, jid) });
      const result = await reviewJoinRequest(sctx, jid, action, parseOptionalText(body.reason, "reason", 500));
      return jsonOk(result, result.pendingApproval ? 202 : 200);
    },
    { mutation: true }
  );
}
