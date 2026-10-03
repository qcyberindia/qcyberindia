import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { dailyReport, memberStatement, navHistoryReport, positionsReport, taxReport } from "@/lib/fund/services/reports";
import { todayIst } from "@/lib/fund/services/types";
import { parseEnum, parseOptionalId, parseOptionalIsoDate } from "@/lib/fund/validation";

const TYPES = ["daily", "nav-history", "statement", "tax", "positions"] as const;

export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, ctx }) => {
    assertPermission(ctx.actor, "reports:view");
    const sp = req.nextUrl.searchParams;
    const from = parseOptionalIsoDate(sp.get("from"), "from");
    const to = parseOptionalIsoDate(sp.get("to"), "to");
    const db = readDb();
    switch (parseEnum(sp.get("type") ?? "daily", "type", TYPES)) {
      case "daily":
        return jsonOk(await dailyReport(db, ctx, parseOptionalIsoDate(sp.get("date"), "date") ?? todayIst()));
      case "nav-history":
        return jsonOk(await navHistoryReport(db, ctx, from, to));
      case "statement":
        return jsonOk(await memberStatement(db, ctx, parseOptionalId(sp.get("member"), "member") ?? ctx.userId, from, to));
      case "tax":
        return jsonOk(await taxReport(db, ctx, from, to));
      case "positions":
        return jsonOk(await positionsReport(db, ctx));
    }
  });
}
