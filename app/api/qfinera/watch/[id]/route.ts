import type { NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { actionResponse, assertJsonMutation, jsonOk } from "@/lib/fund/http";
import { parseEnum, parseId, parseOptionalText, readJsonObject } from "@/lib/fund/validation";
import { deleteWatchItem, getWatchItem, requireWatchActor, setWatchArchived, updateWatchItem } from "@/lib/watch/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const db = readDb();
    const actor = await requireWatchActor(req, db);
    return jsonOk({ item: await getWatchItem(db, actor, parseId((await params).id, "id")) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** Edit. The author and ADMIN edit directly; a MANAGER's edit of another's item waits for ADMIN approval (202). */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    assertJsonMutation(req);
    const db = readDb();
    const actor = await requireWatchActor(req, db);
    const id = parseId((await params).id, "id");
    return actionResponse(await updateWatchItem(db, actor, id, await readJsonObject(req), requestMeta(req)));
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** { action: "archive" | "restore" | "delete", reason? } */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    assertJsonMutation(req);
    const db = readDb();
    const actor = await requireWatchActor(req, db);
    const id = parseId((await params).id, "id");
    const body = await readJsonObject(req);
    const meta = requestMeta(req);
    switch (parseEnum(body.action, "action", ["archive", "restore", "delete"] as const)) {
      case "archive":
        return jsonOk({ item: await setWatchArchived(db, actor, id, true, meta) });
      case "restore":
        return jsonOk({ item: await setWatchArchived(db, actor, id, false, meta) });
      case "delete":
        return actionResponse(await deleteWatchItem(db, actor, id, parseOptionalText(body.reason, "reason", 500), meta));
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}
