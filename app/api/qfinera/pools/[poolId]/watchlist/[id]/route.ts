import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import {
  WATCHLIST_STATUSES,
  addWatchlistComment,
  getWatchlistItem,
  setWatchlistArchived,
  updateWatchlistItem,
} from "@/lib/fund/services/watchlist";
import { parseEnum, parseOptionalText, parseOptionalUrl, parseText, readJsonObject } from "@/lib/fund/validation";

export async function GET(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(req, params, async ({ sctx, id }) => jsonOk(await getWatchlistItem(readDb(), sctx, itemId(id))));
}

export async function PATCH(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      const item = await updateWatchlistItem(sctx, itemId(id), {
        title: body.title === undefined ? undefined : parseText(body.title, "title", { min: 3, max: 140 }),
        thesis: body.thesis === undefined ? undefined : parseOptionalText(body.thesis, "thesis", 4000),
        notes: body.notes === undefined ? undefined : parseOptionalText(body.notes, "notes", 4000),
        researchUrl: body.researchUrl === undefined ? undefined : parseOptionalUrl(body.researchUrl, "researchUrl"),
        status: body.status === undefined ? undefined : parseEnum(body.status, "status", WATCHLIST_STATUSES),
      });
      return jsonOk({ item });
    },
    { mutation: true }
  );
}

/** comment (any member) | archive | restore (MANAGER/ADMIN). */
export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      const wid = itemId(id);
      switch (parseEnum(body.action, "action", ["comment", "archive", "restore"] as const)) {
        case "comment":
          return jsonOk({ comment: await addWatchlistComment(sctx, wid, parseText(body.body, "body", { max: 2000 })) }, 201);
        case "archive":
          return jsonOk({ item: await setWatchlistArchived(sctx, wid, true) });
        case "restore":
          return jsonOk({ item: await setWatchlistArchived(sctx, wid, false) });
      }
    },
    { mutation: true }
  );
}
