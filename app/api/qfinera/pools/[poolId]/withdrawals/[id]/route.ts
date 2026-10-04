import type { NextRequest } from "next/server";
import { one, readDb } from "@/lib/fund/db";
import { actionResponse, jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { actOrPropose } from "@/lib/fund/services/change-requests";
import { cancelWithdrawal, getWithdrawalDetail } from "@/lib/fund/services/withdrawals";
import { parseEnum, parseOptionalText, readJsonObject } from "@/lib/fund/validation";

const ACTIONS = ["approve", "reject", "cancel", "finalize"] as const;

export async function GET(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(req, params, async ({ ctx, id }) => {
    assertPermission(ctx.actor, "withdrawals:view_own");
    return jsonOk(await getWithdrawalDetail(readDb(), ctx.actor, ctx.fund.id, itemId(id)));
  });
}

/** ADMIN-only steps taken by a MANAGER become requests for ADMIN approval. */
export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      const wid = itemId(id);
      switch (parseEnum(body.action, "action", ACTIONS)) {
        case "approve":
          return actionResponse(await actOrPropose(sctx, "withdrawal.approve", wid, body));
        case "reject":
          return actionResponse(await actOrPropose(sctx, "withdrawal.reject", wid, body));
        case "cancel": {
          const own = await one<{ member_id: number }>(
            readDb(),
            "SELECT member_id FROM qfinera_fund_withdrawals WHERE fund_id = $1 AND id = $2",
            [sctx.fundId, wid]
          );
          if (own && own.member_id === sctx.actor.userId) {
            return jsonOk({ withdrawal: await cancelWithdrawal(sctx, wid, parseOptionalText(body.reason, "reason", 500)) });
          }
          return actionResponse(await actOrPropose(sctx, "withdrawal.cancel", wid, body));
        }
        case "finalize":
          return actionResponse(await actOrPropose(sctx, "withdrawal.finalize", wid, body));
      }
    },
    { mutation: true }
  );
}
