import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { jsonOk } from "@/lib/fund/http";
import { parseEnum } from "@/lib/fund/validation";
import { listWatchRequests, requireWatchActor } from "@/lib/watch/service";

/** Moderation requests: platform ADMIN sees all; platform MANAGER sees their own. */
export async function GET(req: NextRequest) {
  try {
    const db = readDb();
    const actor = await requireWatchActor(req, db);
    const status = parseEnum(req.nextUrl.searchParams.get("status") ?? "open", "status", ["open", "closed", "all"] as const);
    return jsonOk({ requests: await listWatchRequests(db, actor, status) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
