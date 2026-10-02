import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { EXCHANGES, createInstrument, listInstruments } from "@/lib/fund/services/market";
import { parseEnum, parseOptionalText, parseText, readJsonObject } from "@/lib/fund/validation";

/** NSE/BSE instrument search (shared reference data). */
export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, ctx }) => {
    assertPermission(ctx.actor, "holdings:view");
    const sp = req.nextUrl.searchParams;
    const instruments = await listInstruments(readDb(), {
      q: parseOptionalText(sp.get("q"), "q", 60),
      exchange: sp.get("exchange") ? parseEnum(sp.get("exchange"), "exchange", EXCHANGES) : null,
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
      const instrument = await createInstrument(sctx, {
        symbol: parseText(body.symbol, "symbol", { max: 30 }),
        exchange: parseEnum(body.exchange, "exchange", EXCHANGES),
        name: parseOptionalText(body.name, "name", 120),
      });
      return jsonOk({ instrument }, 201);
    },
    { mutation: true }
  );
}
