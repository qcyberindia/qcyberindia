import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { WATCHLIST_STATUSES, createWatchlistItem, listWatchlist } from "@/lib/fund/services/watchlist";
import { parseEnum, parseId, parseOptionalText, parseOptionalUrl, parseText, readJsonObject } from "@/lib/fund/validation";

export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, sctx }) => {
    const sp = req.nextUrl.searchParams;
    const items = await listWatchlist(readDb(), sctx, {
      status: sp.get("status") ? parseEnum(sp.get("status"), "status", WATCHLIST_STATUSES) : null,
      archived: sp.get("archived") === "1",
    });
    return jsonOk({ watchlist: items });
  });
}

export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => {
      const body = await readJsonObject(req);
      const item = await createWatchlistItem(sctx, {
        instrumentId: parseId(body.instrumentId, "instrumentId"),
        title: parseText(body.title, "title", { min: 3, max: 140 }),
        thesis: parseOptionalText(body.thesis, "thesis", 4000),
        notes: parseOptionalText(body.notes, "notes", 4000),
        researchUrl: parseOptionalUrl(body.researchUrl, "researchUrl"),
        status: parseEnum(body.status ?? "IDEA", "status", WATCHLIST_STATUSES),
      });
      return jsonOk({ item }, 201);
    },
    { mutation: true }
  );
}
