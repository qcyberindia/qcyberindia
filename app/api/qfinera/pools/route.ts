import type { NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { requireActiveSession } from "@/lib/fund/auth";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, jsonOk } from "@/lib/fund/http";
import { CREATE_POOL_ACKNOWLEDGEMENT, MAX_POOLS_CREATED_PER_USER, PARTICIPATION_MODE } from "@/lib/fund/product-gate";
import { pendingInvitesFor } from "@/lib/fund/services/invites";
import { createPool, listMyPools } from "@/lib/fund/services/pools";
import { parseOptionalText, parseText, readJsonObject } from "@/lib/fund/validation";

/** The caller's own pools and the invites addressed to them. Never other pools. */
export async function GET(req: NextRequest) {
  try {
    const session = await requireActiveSession(req);
    const db = readDb();
    const [pools, invites] = await Promise.all([listMyPools(db, session.userId), pendingInvitesFor(db, session.email)]);
    return jsonOk({
      pools,
      invites,
      gate: { participationMode: PARTICIPATION_MODE, acknowledgement: CREATE_POOL_ACKNOWLEDGEMENT, maxPoolsCreated: MAX_POOLS_CREATED_PER_USER },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** Create a private pool. The creator becomes its ADMIN. */
export async function POST(req: NextRequest) {
  try {
    assertJsonMutation(req);
    const session = await requireActiveSession(req);
    const body = await readJsonObject(req);
    const pool = await createPool(
      { userId: session.userId, meta: requestMeta(req) },
      {
        name: parseText(body.name, "name", { min: 3, max: 120 }),
        description: parseOptionalText(body.description, "description", 1000),
        acknowledgePrivate: body.acknowledgePrivate === true,
      }
    );
    return jsonOk({ pool }, 201);
  } catch (err) {
    return toErrorResponse(err);
  }
}
