import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { EXCHANGES, INSTRUMENT_TYPES, createInstrument, listInstruments, type NewInstrument } from "@/lib/fund/services/market";
import {
  parseDecimal,
  parseEnum,
  parseId,
  parseIsoDate,
  parseOptionalDecimal,
  parseOptionalIsoDate,
  parseOptionalText,
  parseText,
  readJsonObject,
} from "@/lib/fund/validation";

const OPTION_TYPES = ["CE", "PE"] as const;

/**
 * Instrument search (shared reference data). `type` narrows to EQUITY,
 * FUTURE or OPTION; contracts can be narrowed further by expiry, strike
 * and CE/PE.
 */
export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, ctx }) => {
    assertPermission(ctx.actor, "holdings:view");
    const sp = req.nextUrl.searchParams;
    const instruments = await listInstruments(readDb(), {
      q: parseOptionalText(sp.get("q"), "q", 60),
      exchange: sp.get("exchange") ? parseEnum(sp.get("exchange"), "exchange", EXCHANGES) : null,
      type: sp.get("type") ? parseEnum(sp.get("type"), "type", INSTRUMENT_TYPES) : null,
      expiry: parseOptionalIsoDate(sp.get("expiry"), "expiry"),
      strike: parseOptionalDecimal(sp.get("strike"), { label: "strike", scale: 4 })?.toDecimalString(4) ?? null,
      optionType: sp.get("optionType") ? parseEnum(sp.get("optionType"), "optionType", OPTION_TYPES) : null,
      limit: 50,
    });
    return jsonOk({ instruments });
  });
}

export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => {
      const body = await readJsonObject(req);
      const instrumentType = body.instrumentType === undefined ? "EQUITY" : parseEnum(body.instrumentType, "instrumentType", INSTRUMENT_TYPES);
      const exchange = parseEnum(body.exchange, "exchange", EXCHANGES);
      let input: NewInstrument;
      if (instrumentType === "EQUITY") {
        input = { instrumentType, exchange, symbol: parseText(body.symbol, "symbol", { max: 30 }), name: parseOptionalText(body.name, "name", 120) };
      } else {
        input = {
          instrumentType,
          exchange,
          underlying: parseText(body.underlying, "underlying", { max: 30 }),
          expiryDate: parseIsoDate(body.expiryDate, "expiryDate"),
          strikePrice: body.strikePrice === undefined ? null : parseDecimal(body.strikePrice, { label: "strikePrice", scale: 4, positive: true }),
          optionType: body.optionType === undefined ? null : parseEnum(body.optionType, "optionType", OPTION_TYPES),
          lotSize: body.lotSize === undefined || body.lotSize === null ? null : parseId(body.lotSize, "lotSize"),
        };
      }
      const instrument = await createInstrument(sctx, input);
      return jsonOk({ instrument }, 201);
    },
    { mutation: true }
  );
}
