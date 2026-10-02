import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import {
  WITHDRAWAL_STATUSES,
  createWithdrawal,
  listWithdrawals,
  type WithdrawalRequestType,
} from "@/lib/fund/services/withdrawals";
import { parseDecimal, parseEnum, parseOptionalId, parsePaging, readJsonObject } from "@/lib/fund/validation";

const TYPES: readonly WithdrawalRequestType[] = ["AMOUNT", "UNITS"];

export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, ctx }) => {
    assertPermission(ctx.actor, "withdrawals:view_own");
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") ? parseEnum(sp.get("status"), "status", WITHDRAWAL_STATUSES) : null;
    const { page, pageSize, offset } = parsePaging(sp);
    const { rows, total } = await listWithdrawals(readDb(), ctx.actor, ctx.fund.id, {
      status,
      memberId: parseOptionalId(sp.get("member"), "member"),
      pageSize,
      offset,
    });
    return jsonOk({ withdrawals: rows, page, pageSize, total });
  });
}

export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => {
      const body = await readJsonObject(req);
      const requestType = parseEnum(body.requestType, "requestType", TYPES);
      const withdrawal = await createWithdrawal(sctx, {
        memberId: parseOptionalId(body.memberId, "memberId"),
        requestType,
        amount: requestType === "AMOUNT" ? parseDecimal(body.amount, { label: "amount", scale: 2, positive: true }) : null,
        units: requestType === "UNITS" ? parseDecimal(body.units, { label: "units", scale: 4, positive: true }) : null,
      });
      return jsonOk({ withdrawal }, 201);
    },
    { mutation: true }
  );
}
