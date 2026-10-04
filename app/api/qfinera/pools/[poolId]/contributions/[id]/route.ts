import type { NextRequest } from "next/server";
import { readDb, one } from "@/lib/fund/db";
import { actionResponse, jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { getContributionDetail } from "@/lib/fund/queries";
import { assertPermission } from "@/lib/fund/rbac";
import { actOrPropose } from "@/lib/fund/services/change-requests";
import { cancelContribution } from "@/lib/fund/services/contributions";
import { parseEnum, parseOptionalText, readJsonObject } from "@/lib/fund/validation";

const ACTIONS = ["approve", "confirm-funds", "reject", "cancel", "finalize"] as const;

export async function GET(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(req, params, async ({ ctx, id }) => {
    assertPermission(ctx.actor, "contributions:view_own");
    return jsonOk(await getContributionDetail(readDb(), ctx, itemId(id)));
  });
}

/**
 * One lifecycle step. The service re-checks the role and the current status.
 * ADMIN-only steps taken by a MANAGER become requests for ADMIN approval.
 */
export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      const cid = itemId(id);
      switch (parseEnum(body.action, "action", ACTIONS)) {
        case "approve":
          return actionResponse(await actOrPropose(sctx, "contribution.approve", cid, body));
        case "confirm-funds":
          return actionResponse(await actOrPropose(sctx, "contribution.confirm_funds", cid, body));
        case "reject":
          return actionResponse(await actOrPropose(sctx, "contribution.reject", cid, body));
        case "cancel": {
          // Cancelling your own request is yours to do; someone else's is an approval-level change.
          const own = await one<{ member_id: number }>(
            readDb(),
            "SELECT member_id FROM qfinera_fund_contributions WHERE fund_id = $1 AND id = $2",
            [sctx.fundId, cid]
          );
          if (own && own.member_id === sctx.actor.userId) {
            return jsonOk({ contribution: await cancelContribution(sctx, cid, parseOptionalText(body.reason, "reason", 500)) });
          }
          return actionResponse(await actOrPropose(sctx, "contribution.cancel", cid, body));
        }
        case "finalize":
          return actionResponse(await actOrPropose(sctx, "contribution.finalize", cid, body));
      }
    },
    { mutation: true }
  );
}
