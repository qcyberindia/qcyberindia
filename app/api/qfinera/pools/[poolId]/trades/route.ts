import type { NextRequest } from "next/server";
import { Money } from "@/lib/accounting/money";
import type { TradeSide } from "@/lib/accounting/trades";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { TRADE_STATUSES, createTrade, listTrades } from "@/lib/fund/services/trades";
import {
  parseBackdate,
  parseDecimal,
  parseEnum,
  parseId,
  parseIsoDate,
  parseOptionalDecimal,
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
      const charge = (key: string) => parseOptionalDecimal(body[key], { label: key, scale: 2 }) ?? Money.zero();
      const trade = await createTrade(sctx, {
        instrumentId: parseId(body.instrumentId, "instrumentId"),
        side: parseEnum(body.side, "side", SIDES),
        tradeDate: parseIsoDate(body.tradeDate, "tradeDate"),
        settlementDate: parseOptionalIsoDate(body.settlementDate, "settlementDate"),
        quantity: parseDecimal(body.quantity, { label: "quantity", scale: 4, positive: true }),
        price: parseDecimal(body.price, { label: "price", scale: 4, positive: true }),
        charges: {
          brokerage: charge("brokerage"),
          stt: charge("stt"),
          gst: charge("gst"),
          stampDuty: charge("stampDuty"),
          otherCharges: charge("otherCharges"),
        },
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
