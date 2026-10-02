import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { notFoundError } from "@/lib/fund/errors";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { listInstruments, quotesFor, recordPrice } from "@/lib/fund/services/market";
import { parseDecimal, parseEnum, parseIsoDate, parseOptionalTime, readJsonObject } from "@/lib/fund/validation";

/** One instrument with its current quote (quality-labelled; may be unavailable). */
export async function GET(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(req, params, async ({ ctx, id }) => {
    assertPermission(ctx.actor, "holdings:view");
    const db = readDb();
    const [instrument] = await listInstruments(db, { q: null, exchange: null, ids: [itemId(id)], limit: 1 });
    if (!instrument) throw notFoundError("Instrument");
    const quotes = await quotesFor(db, ctx.fund.id, [instrument]);
    return jsonOk({ instrument, quote: quotes.get(instrument.id) ?? null });
  });
}

/** ADMIN records an EOD/MANUAL price snapshot for this pool (append-only). */
export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      parseEnum(body.action, "action", ["record-price"] as const);
      const price = await recordPrice(sctx, {
        instrumentId: itemId(id),
        price: parseDecimal(body.price, { label: "price", scale: 4, positive: true }),
        quality: parseEnum(body.quality ?? "EOD", "quality", ["EOD", "MANUAL"] as const),
        date: parseIsoDate(body.date, "date"),
        time: parseOptionalTime(body.time, "time"),
      });
      return jsonOk({ price }, 201);
    },
    { mutation: true }
  );
}
