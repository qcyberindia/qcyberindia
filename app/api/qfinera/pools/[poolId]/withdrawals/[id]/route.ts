import type { NextRequest } from "next/server";
import { Money } from "@/lib/accounting/money";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import {
  approveWithdrawal,
  cancelWithdrawal,
  finalizeWithdrawal,
  getWithdrawalDetail,
  rejectWithdrawal,
} from "@/lib/fund/services/withdrawals";
import { parseEnum, parseOptionalDecimal, parseOptionalText, parseText, readJsonObject } from "@/lib/fund/validation";

const ACTIONS = ["approve", "reject", "cancel", "finalize"] as const;

export async function GET(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(req, params, async ({ ctx, id }) => {
    assertPermission(ctx.actor, "withdrawals:view_own");
    return jsonOk(await getWithdrawalDetail(readDb(), ctx.actor, ctx.fund.id, itemId(id)));
  });
}

export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      const wid = itemId(id);
      switch (parseEnum(body.action, "action", ACTIONS)) {
        case "approve":
          return jsonOk(
            await approveWithdrawal(sctx, wid, {
              charges: parseOptionalDecimal(body.charges, { label: "charges", scale: 2 }) ?? Money.zero(),
            })
          );
        case "reject":
          return jsonOk({ withdrawal: await rejectWithdrawal(sctx, wid, parseText(body.reason, "reason", { min: 3, max: 500 })) });
        case "cancel":
          return jsonOk({ withdrawal: await cancelWithdrawal(sctx, wid, parseOptionalText(body.reason, "reason", 500)) });
        case "finalize":
          return jsonOk({ withdrawal: await finalizeWithdrawal(sctx, wid) });
      }
    },
    { mutation: true }
  );
}
