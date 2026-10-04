import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { actionResponse, jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { actOrPropose } from "@/lib/fund/services/change-requests";
import { getSettings } from "@/lib/fund/services/settings";
import { readJsonObject } from "@/lib/fund/validation";

export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ ctx }) => {
    assertPermission(ctx.actor, "settings:view");
    return jsonOk({ settings: await getSettings(readDb(), ctx.fund.id) });
  });
}

/** ADMIN changes settings; a MANAGER's change becomes a request for ADMIN approval. */
export async function PATCH(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => actionResponse(await actOrPropose(sctx, "settings.update", null, await readJsonObject(req))),
    { mutation: true }
  );
}
