import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { approveChangeRequest, cancelChangeRequest, rejectChangeRequest } from "@/lib/fund/services/change-requests";
import { parseEnum, parseOptionalText, parseText, readJsonObject } from "@/lib/fund/validation";

/** ADMIN: approve (applies the change) or reject. Requester: cancel. */
export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      const rid = itemId(id);
      switch (parseEnum(body.action, "action", ["approve", "reject", "cancel"] as const)) {
        case "approve":
          return jsonOk(await approveChangeRequest(sctx, rid, parseOptionalText(body.reason, "reason", 500)));
        case "reject":
          return jsonOk({ request: await rejectChangeRequest(sctx, rid, parseText(body.reason, "reason", { min: 3, max: 500 })) });
        case "cancel":
          return jsonOk({ request: await cancelChangeRequest(sctx, rid) });
      }
    },
    { mutation: true }
  );
}
