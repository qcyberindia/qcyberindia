import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { validationError } from "@/lib/fund/errors";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { cancelDraftTrade, correctTrade, executeTrade, getTradeDetail, reverseTrade, settleTrade } from "@/lib/fund/services/trades";
import { parseTicket } from "@/lib/fund/trade-ticket";
import {
  parseBackdate,
  parseEnum,
  parseOptionalIsoDate,
  parseOptionalText,
  parseText,
  readJsonObject,
} from "@/lib/fund/validation";

const ACTIONS = ["execute", "settle", "cancel", "reverse", "correct"] as const;

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
        case "correct": {
          // { action: "correct", trade: { ...ticket fields, action: <position action> }, settlementDate?, externalRef?, notes?, reason, confirm? }
          const t = body.trade;
          if (!t || typeof t !== "object" || Array.isArray(t)) throw validationError("Send the corrected trade.", { trade: "Required" });
          const ticket = parseTicket(t as Record<string, unknown>);
          return jsonOk(
            await correctTrade(sctx, tid, {
              ...ticket,
              settlementDate: parseOptionalIsoDate(body.settlementDate, "settlementDate"),
              externalRef: parseOptionalText(body.externalRef, "externalRef", 64),
              notes: parseOptionalText(body.notes, "notes", 1000),
              reason: parseText(body.reason, "reason", { min: 10, max: 500 }),
              confirmed: body.confirm === true,
            })
          );
        }
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
