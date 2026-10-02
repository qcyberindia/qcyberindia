import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { cancelDraftTrade, executeTrade, getTradeDetail, reverseTrade, settleTrade } from "@/lib/fund/services/trades";
import {
  parseBackdate,
  parseEnum,
  parseOptionalIsoDate,
  parseOptionalText,
  parseText,
  readJsonObject,
} from "@/lib/fund/validation";

const ACTIONS = ["execute", "settle", "cancel", "reverse"] as const;

export async function GET(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(req, params, async ({ ctx, id }) => {
    assertPermission(ctx.actor, "trades:view");
    return jsonOk(await getTradeDetail(readDb(), ctx.actor, ctx.fund.id, itemId(id)));
  });
}

export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      const tid = itemId(id);
      switch (parseEnum(body.action, "action", ACTIONS)) {
        case "execute":
          return jsonOk({ trade: await executeTrade(sctx, tid, parseBackdate(body)) });
        case "settle":
          return jsonOk({ trade: await settleTrade(sctx, tid, parseOptionalIsoDate(body.settlementDate, "settlementDate")) });
        case "cancel":
          return jsonOk({ trade: await cancelDraftTrade(sctx, tid, parseOptionalText(body.reason, "reason", 500)) });
        case "reverse":
          return jsonOk({
            trade: await reverseTrade(sctx, tid, {
              reason: parseText(body.reason, "reason", { min: 10, max: 500 }),
              confirmed: body.confirm === true,
            }),
          });
      }
    },
    { mutation: true }
  );
}
