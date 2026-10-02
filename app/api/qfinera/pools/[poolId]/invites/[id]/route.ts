import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { revokeInvite } from "@/lib/fund/services/invites";
import { parseEnum, readJsonObject } from "@/lib/fund/validation";

export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      parseEnum(body.action, "action", ["revoke"] as const);
      return jsonOk({ invite: await revokeInvite(sctx, itemId(id)) });
    },
    { mutation: true }
  );
}
