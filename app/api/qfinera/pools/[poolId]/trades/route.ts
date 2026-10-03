import type { NextRequest } from "next/server";
import { PRODUCTS } from "@/lib/accounting/positions";
import type { TradeSide } from "@/lib/accounting/trades";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { TRADE_STATUSES, createTrade, listTrades } from "@/lib/fund/services/trades";
import { parseTicket } from "@/lib/fund/trade-ticket";
import {
  parseBackdate,
  parseEnum,
  parseOptionalId,
  parseOptionalIsoDate,
  parseOptionalText,
  parsePaging,
  readJsonObject,
} from "@/lib/fund/validation";

const SIDES: readonly TradeSide[] = ["BUY", "SELL"];

export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, ctx }) => {
    assertPermission(ctx.actor, "trades:view");
    const sp = req.nextUrl.searchParams;
    const { page, pageSize, offset } = parsePaging(sp);
    const { rows, total } = await listTrades(readDb(), ctx.actor, ctx.fund.id, {
      status: sp.get("status") ? parseEnum(sp.get("status"), "status", TRADE_STATUSES) : null,
      side: sp.get("side") ? parseEnum(sp.get("side"), "side", SIDES) : null,
      instrumentId: parseOptionalId(sp.get("instrument"), "instrument"),
      product: sp.get("product") ? parseEnum(sp.get("product"), "product", PRODUCTS) : null,
      direction: sp.get("direction") ? parseEnum(sp.get("direction"), "direction", ["LONG", "SHORT"] as const) : null,
      phase: sp.get("phase") ? parseEnum(sp.get("phase"), "phase", ["OPEN", "CLOSE"] as const) : null,
      from: parseOptionalIsoDate(sp.get("from"), "from"),
      to: parseOptionalIsoDate(sp.get("to"), "to"),
      pageSize,
      offset,
    });
    return jsonOk({ trades: rows, page, pageSize, total });
  });
}

export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => {
      const body = await readJsonObject(req);
      const trade = await createTrade(sctx, {
        ...parseTicket(body),
        settlementDate: parseOptionalIsoDate(body.settlementDate, "settlementDate"),
        externalRef: parseOptionalText(body.externalRef, "externalRef", 64),
        notes: parseOptionalText(body.notes, "notes", 1000),
        execute: body.execute === true,
        backdate: parseBackdate(body),
      });
      return jsonOk({ trade }, 201);
    },
    { mutation: true }
  );
}
