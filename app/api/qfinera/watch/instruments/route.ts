import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { jsonOk } from "@/lib/fund/http";
import { listInstruments } from "@/lib/fund/services/market";
import { requireWatchActor } from "@/lib/watch/service";

/** Equity search over the shared instrument master, to tag a Global Watch item. */
export async function GET(req: NextRequest) {
  try {
    const db = readDb();
    await requireWatchActor(req, db);
    const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 40) ?? "";
    if (q.length < 2) return jsonOk({ instruments: [] });
    return jsonOk({ instruments: await listInstruments(db, { q, exchange: null, limit: 10, type: "EQUITY" }) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
