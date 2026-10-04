import type { NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, jsonOk } from "@/lib/fund/http";
import { parseEnum, readJsonObject } from "@/lib/fund/validation";
import { WATCH_CATEGORIES, createWatchItem, listWatch, parseWatchInput, requireWatchActor } from "@/lib/watch/service";

/** Global Watch feed for any signed-in QFinera account. ?q=&category=&sort=latest|updated&mine=1&status=ARCHIVED&page= */
export async function GET(req: NextRequest) {
  try {
    const db = readDb();
    const actor = await requireWatchActor(req, db);
    const sp = req.nextUrl.searchParams;
    const category = sp.get("category");
    const result = await listWatch(db, actor, {
      q: sp.get("q")?.slice(0, 100) ?? null,
      category: category ? parseEnum(category, "category", WATCH_CATEGORIES) : null,
      sort: parseEnum(sp.get("sort") ?? "latest", "sort", ["latest", "updated"] as const),
      mine: sp.get("mine") === "1",
      status: parseEnum(sp.get("status") ?? "PUBLISHED", "status", ["PUBLISHED", "ARCHIVED"] as const),
      page: Math.min(500, Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1)),
    });
    return jsonOk({ ...result, viewer: { userId: actor.userId, platformRole: actor.platformRole } });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** Publish an item. The author is always the signed-in account. */
export async function POST(req: NextRequest) {
  try {
    assertJsonMutation(req);
    const db = readDb();
    const actor = await requireWatchActor(req, db);
    const body = await readJsonObject(req);
    const item = await createWatchItem(actor, parseWatchInput(body, false), requestMeta(req));
    return jsonOk({ item }, 201);
  } catch (err) {
    return toErrorResponse(err);
  }
}
