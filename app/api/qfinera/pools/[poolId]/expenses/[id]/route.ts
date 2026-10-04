import type { NextRequest } from "next/server";
import { actionResponse } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { actOrPropose } from "@/lib/fund/services/change-requests";
import { parseEnum, readJsonObject } from "@/lib/fund/validation";

/** ADMIN approves or rejects; a MANAGER's decision becomes a request for ADMIN approval. */
export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      const eid = itemId(id);
      const action = parseEnum(body.action, "action", ["approve", "reject"] as const);
      return actionResponse(await actOrPropose(sctx, action === "approve" ? "expense.approve" : "expense.reject", eid, body));
    },
    { mutation: true }
  );
}
