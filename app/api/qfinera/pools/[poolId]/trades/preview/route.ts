import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { previewTrade } from "@/lib/fund/services/trades";
import { parseTicket } from "@/lib/fund/trade-ticket";
import { readJsonObject } from "@/lib/fund/validation";

/**
 * What a ticket would do if executed now: position before/after, cash
 * impact, realized P&L. Writes nothing (JSON + same-origin is still
 * enforced, like every POST).
 */
export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => {
      const preview = await previewTrade(readDb(), sctx, parseTicket(await readJsonObject(req)));
      return jsonOk({ preview });
    },
    { mutation: true }
  );
}
