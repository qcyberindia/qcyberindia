import type { NextRequest } from "next/server";
import { requireFundContext, requireFundPermission } from "@/lib/fund/auth";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse, validationError } from "@/lib/fund/errors";
import { assertJsonMutation, fundIdFrom, jsonOk, serviceCtx } from "@/lib/fund/http";
import { listContributions } from "@/lib/fund/queries";
import { createContribution, type ContributionStatus } from "@/lib/fund/services/contributions";
import { todayIst } from "@/lib/fund/services/types";
import {
  parseDecimal,
  parseEnum,
  parseIsoDate,
  parseOptionalId,
  parseOptionalText,
  parsePaging,
  readJsonObject,
} from "@/lib/fund/validation";

const STATUSES: readonly ContributionStatus[] = [
  "PENDING",
  "APPROVED",
  "AWAITING_NAV",
  "FINALIZED",
  "REJECTED",
  "CANCELLED",
];

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireFundPermission(req, "contributions:view_own", fundIdFrom(req));
    const params = req.nextUrl.searchParams;
    const rawStatus = params.get("status");
    const status = rawStatus ? parseEnum(rawStatus, "status", STATUSES) : null;
    const memberId = parseOptionalId(params.get("member"), "member");
    const { page, pageSize, offset } = parsePaging(params);

    const { rows, total } = await listContributions(readDb(), ctx, { status, memberId, pageSize, offset });
    return jsonOk({ contributions: rows, page, pageSize, total });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertJsonMutation(req);
    const ctx = await requireFundContext(req, fundIdFrom(req));
    const body = await readJsonObject(req);

    const amount = parseDecimal(body.amount, { label: "amount", scale: 2, positive: true });
    const paymentDate = parseIsoDate(body.paymentDate, "paymentDate");
    if (paymentDate > todayIst()) {
      throw validationError("The payment date cannot be in the future.", { paymentDate: "Cannot be in the future" });
    }

    // createContribution checks the permission itself: contributions:create_own
    // for yourself, contributions:create_for_member for someone else.
    const contribution = await createContribution(serviceCtx(ctx, req), {
      memberId: parseOptionalId(body.memberId, "memberId"),
      amount,
      paymentDate,
      utr: parseOptionalText(body.utr, "utr", 64),
      paymentProofReference: parseOptionalText(body.paymentProofReference, "paymentProofReference", 200),
    });
    return jsonOk({ contribution }, 201);
  } catch (err) {
    return toErrorResponse(err);
  }
}
