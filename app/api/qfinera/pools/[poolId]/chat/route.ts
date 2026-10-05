import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { listMessages, postMessage } from "@/lib/fund/services/chat";
import { parseOptionalId, readJsonObject } from "@/lib/fund/validation";

/** Pool Chat, latest page (or ?before=<id> for the page older than that message). Every active member. */
export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, ctx }) => {
    const before = parseOptionalId(req.nextUrl.searchParams.get("before"), "before");
    return jsonOk(await listMessages(readDb(), ctx.actor, ctx.fund.id, { before }));
  });
}

/** Post a message: { body }. Every active member, VIEWER included. */
export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => {
      const body = await readJsonObject(req, 16 * 1024);
      return jsonOk({ message: await postMessage(sctx, body.body) }, 201);
    },
    { mutation: true }
  );
}
