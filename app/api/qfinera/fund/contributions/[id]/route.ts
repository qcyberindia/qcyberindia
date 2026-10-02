import type { NextRequest } from "next/server";
import { requireFundContext, requireFundPermission } from "@/lib/fund/auth";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, fundIdFrom, jsonOk, serviceCtx, type IdParams } from "@/lib/fund/http";
import { getContributionDetail } from "@/lib/fund/queries";
import {
  approveContribution,
  cancelContribution,
  confirmContributionFunds,
  finalizeContribution,
  rejectContribution,
} from "@/lib/fund/services/contributions";
import { parseEnum, parseId, parseOptionalText, parseText, readJsonObject } from "@/lib/fund/validation";

const ACTIONS = ["approve", "confirm-funds", "reject", "cancel", "finalize"] as const;

export async function GET(req: NextRequest, { params }: IdParams) {
  try {
    const id = parseId((await params).id, "id");
    const ctx = await requireFundPermission(req, "contributions:view_own", fundIdFrom(req));
    return jsonOk(await getContributionDetail(readDb(), ctx, id));
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * One lifecycle step on a contribution. The service re-checks the role for
 * the specific step (approve / confirm funds / finalize are ADMIN-only; a
 * member may cancel only their own PENDING request) and the current status.
 */
export async function POST(req: NextRequest, { params }: IdParams) {
  try {
    assertJsonMutation(req);
    const id = parseId((await params).id, "id");
    const ctx = await requireFundContext(req, fundIdFrom(req));
    const body = await readJsonObject(req);
    const action = parseEnum(body.action, "action", ACTIONS);
    const sctx = serviceCtx(ctx, req);

    switch (action) {
      case "approve":
        return jsonOk({ contribution: await approveContribution(sctx, id) });
      case "confirm-funds": {
        const { contribution, applicableNavDate } = await confirmContributionFunds(sctx, id);
        return jsonOk({ contribution, applicableNavDate });
      }
      case "reject":
        return jsonOk({
          contribution: await rejectContribution(sctx, id, parseText(body.reason, "reason", { min: 3, max: 500 })),
        });
      case "cancel":
        return jsonOk({
          contribution: await cancelContribution(sctx, id, parseOptionalText(body.reason, "reason", 500)),
        });
      case "finalize":
        return jsonOk({ contribution: await finalizeContribution(sctx, id) });
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}
