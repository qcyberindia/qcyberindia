import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { getContributionDetail } from "@/lib/fund/queries";
import { assertPermission } from "@/lib/fund/rbac";
import {
  approveContribution,
  cancelContribution,
  confirmContributionFunds,
  finalizeContribution,
  rejectContribution,
} from "@/lib/fund/services/contributions";
import { parseEnum, parseOptionalText, parseText, readJsonObject } from "@/lib/fund/validation";

const ACTIONS = ["approve", "confirm-funds", "reject", "cancel", "finalize"] as const;

export async function GET(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(req, params, async ({ ctx, id }) => {
    assertPermission(ctx.actor, "contributions:view_own");
    return jsonOk(await getContributionDetail(readDb(), ctx, itemId(id)));
  });
}

/** One lifecycle step. The service re-checks the role and the current status. */
export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      const cid = itemId(id);
      switch (parseEnum(body.action, "action", ACTIONS)) {
        case "approve":
          return jsonOk({ contribution: await approveContribution(sctx, cid) });
        case "confirm-funds":
          return jsonOk(await confirmContributionFunds(sctx, cid));
        case "reject":
          return jsonOk({ contribution: await rejectContribution(sctx, cid, parseText(body.reason, "reason", { min: 3, max: 500 })) });
        case "cancel":
          return jsonOk({ contribution: await cancelContribution(sctx, cid, parseOptionalText(body.reason, "reason", 500)) });
        case "finalize":
          return jsonOk({ contribution: await finalizeContribution(sctx, cid) });
      }
    },
    { mutation: true }
  );
}
