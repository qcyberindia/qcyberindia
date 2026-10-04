import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { createJoinRequest, listJoinRequests } from "@/lib/fund/services/join-requests";
import { parseOptionalText, readJsonObject } from "@/lib/fund/validation";

/** Reviewers (MANAGER/ADMIN) see every request; a VIEWER sees their own. */
export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, sctx }) =>
    jsonOk({ joinRequests: await listJoinRequests(readDb(), sctx, { openOnly: req.nextUrl.searchParams.get("open") === "1" }) })
  );
}

/** VIEWER: ask to become a MEMBER, with an optional note. */
export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => {
      const body = await readJsonObject(req);
      return jsonOk({ joinRequest: await createJoinRequest(sctx, parseOptionalText(body.note, "note", 1000)) }, 201);
    },
    { mutation: true }
  );
}
