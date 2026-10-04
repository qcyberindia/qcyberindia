import type { NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, jsonOk } from "@/lib/fund/http";
import { parseEnum, parseId, parseOptionalText, parseText, readJsonObject } from "@/lib/fund/validation";
import { approveWatchRequest, cancelWatchRequest, rejectWatchRequest, requireWatchActor } from "@/lib/watch/service";

type Params = { params: Promise<{ id: string }> };

/** Platform ADMIN: approve (applies the change) or reject. Requester: cancel. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    assertJsonMutation(req);
    const db = readDb();
    const actor = await requireWatchActor(req, db);
    const id = parseId((await params).id, "id");
    const body = await readJsonObject(req);
    const meta = requestMeta(req);
    switch (parseEnum(body.action, "action", ["approve", "reject", "cancel"] as const)) {
      case "approve":
        return jsonOk(await approveWatchRequest(actor, id, parseOptionalText(body.reason, "reason", 500), meta));
      case "reject":
        return jsonOk({ request: await rejectWatchRequest(actor, id, parseText(body.reason, "reason", { min: 3, max: 500 }), meta) });
      case "cancel":
        return jsonOk({ request: await cancelWatchRequest(db, actor, id, meta) });
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}
