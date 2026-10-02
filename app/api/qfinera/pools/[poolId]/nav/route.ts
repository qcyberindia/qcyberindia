import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { previewNav, strikeNav } from "@/lib/fund/services/nav";
import { todayIst } from "@/lib/fund/services/types";
import { parseIsoDate, parseOptionalIsoDate, parseOptionalText, readJsonObject } from "@/lib/fund/validation";

/** ADMIN: what the official NAV for a date would be, and what blocks it. Writes nothing. */
export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, ctx }) => {
    assertPermission(ctx.actor, "nav:finalize");
    const date = parseOptionalIsoDate(req.nextUrl.searchParams.get("date"), "date") ?? todayIst();
    return jsonOk({ preview: await previewNav(readDb(), ctx.fund.id, date) });
  });
}

/** ADMIN: strike the official EOD NAV and finalize the requests waiting for it. */
export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => {
      const body = await readJsonObject(req);
      const result = await strikeNav(sctx, {
        date: parseIsoDate(body.date, "date"),
        correctionReason: parseOptionalText(body.correctionReason, "correctionReason", 500),
        confirmCorrection: body.confirmCorrection === true,
      });
      return jsonOk(result, 201);
    },
    { mutation: true }
  );
}
