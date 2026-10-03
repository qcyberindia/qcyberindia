import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { validationError } from "@/lib/fund/errors";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { listContributions } from "@/lib/fund/queries";
import { assertPermission } from "@/lib/fund/rbac";
import { PAYMENT_METHODS, createContribution, type ContributionStatus } from "@/lib/fund/services/contributions";
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

const STATUSES: readonly ContributionStatus[] = ["PENDING", "APPROVED", "AWAITING_NAV", "FINALIZED", "REJECTED", "CANCELLED"];

export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, ctx }) => {
    assertPermission(ctx.actor, "contributions:view_own");
    const sp = req.nextUrl.searchParams;
    const status = sp.get("status") ? parseEnum(sp.get("status"), "status", STATUSES) : null;
    const memberId = parseOptionalId(sp.get("member"), "member");
    const { page, pageSize, offset } = parsePaging(sp);
    const { rows, total } = await listContributions(readDb(), ctx, { status, memberId, pageSize, offset });
    return jsonOk({ contributions: rows, page, pageSize, total });
  });
}

export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => {
      const body = await readJsonObject(req);
      const paymentDate = parseIsoDate(body.paymentDate, "paymentDate");
      if (paymentDate > todayIst()) {
        throw validationError("The payment date cannot be in the future.", { paymentDate: "Cannot be in the future" });
      }
      const contribution = await createContribution(sctx, {
        memberId: parseOptionalId(body.memberId, "memberId"),
        amount: parseDecimal(body.amount, { label: "amount", scale: 2, positive: true }),
        paymentDate,
        utr: parseOptionalText(body.utr, "utr", 64),
        paymentProofReference: parseOptionalText(body.paymentProofReference, "paymentProofReference", 200),
        paymentMethod: body.paymentMethod === undefined || body.paymentMethod === null ? null : parseEnum(body.paymentMethod, "paymentMethod", PAYMENT_METHODS),
        notes: parseOptionalText(body.notes, "notes", 1000),
      });
      return jsonOk({ contribution }, 201);
    },
    { mutation: true }
  );
}
