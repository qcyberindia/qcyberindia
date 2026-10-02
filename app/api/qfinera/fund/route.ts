import type { NextRequest } from "next/server";
import { requireFundPermission } from "@/lib/fund/auth";
import { toErrorResponse } from "@/lib/fund/errors";
import { fundIdFrom, jsonOk } from "@/lib/fund/http";

/** The caller's fund context: which fund, their role, and the funds they belong to. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireFundPermission(req, "fund:view", fundIdFrom(req));
    return jsonOk({
      fund: ctx.fund,
      role: ctx.actor.role,
      user: { id: ctx.userId, displayName: ctx.displayName },
      funds: ctx.funds,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
