import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { approveExpense, rejectExpense } from "@/lib/fund/services/expenses";
import { parseBackdate, parseEnum, parseText, readJsonObject } from "@/lib/fund/validation";

export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      const eid = itemId(id);
      switch (parseEnum(body.action, "action", ["approve", "reject"] as const)) {
        case "approve":
          return jsonOk({ expense: await approveExpense(sctx, eid, parseBackdate(body)) });
        case "reject":
          return jsonOk({ expense: await rejectExpense(sctx, eid, parseText(body.reason, "reason", { min: 3, max: 500 })) });
      }
    },
    { mutation: true }
  );
}
