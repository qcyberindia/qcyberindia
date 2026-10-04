import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { actionResponse, jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { assertPermission, canPropose } from "@/lib/fund/rbac";
import { actOrPropose } from "@/lib/fund/services/change-requests";
import { previewNav } from "@/lib/fund/services/nav";
import { todayIst } from "@/lib/fund/services/types";
import { parseOptionalIsoDate, readJsonObject } from "@/lib/fund/validation";

/** ADMIN (and MANAGER, to prepare a request): what the official NAV for a date would be, and what blocks it. Writes nothing. */
export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, ctx }) => {
    if (!canPropose(ctx.actor, "nav:finalize")) assertPermission(ctx.actor, "nav:finalize");
    const date = parseOptionalIsoDate(req.nextUrl.searchParams.get("date"), "date") ?? todayIst();
    return jsonOk({ preview: await previewNav(readDb(), ctx.fund.id, date) });
  });
}

/**
 * ADMIN: strike the official EOD NAV and finalize the requests waiting for it.
 * A MANAGER's strike becomes a request for ADMIN approval.
 */
export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => {
      const body = await readJsonObject(req);
      return actionResponse(await actOrPropose(sctx, "nav.finalize", null, body), 201);
    },
    { mutation: true }
  );
}
