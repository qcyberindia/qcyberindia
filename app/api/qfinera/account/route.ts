import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, jsonOk } from "@/lib/fund/http";
import { parseText, readJsonObject } from "@/lib/fund/validation";
import { listMyPools } from "@/lib/fund/services/pools";
import { requireRequestSession } from "@/lib/qfinera-auth/http";
import { getAccount, updateDisplayName } from "@/lib/qfinera-auth/service";
import { listActiveSessions } from "@/lib/qfinera-auth/sessions";

/** The signed-in user's own account. There is no way to read anyone else's. */
export async function GET(req: NextRequest) {
  try {
    const s = await requireRequestSession(req);
    const db = readDb();
    const [account, sessions, pools] = await Promise.all([getAccount(s.userId), listActiveSessions(db, s.userId), listMyPools(db, s.userId)]);
    return jsonOk({
      account,
      sessions: sessions.map((x) => ({ ...x, current: x.id === s.sessionId })),
      pools: pools.map((p) => ({ id: p.id, name: p.name, role: p.role, membershipStatus: p.membershipStatus })),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    assertJsonMutation(req);
    const s = await requireRequestSession(req);
    const body = await readJsonObject(req);
    return jsonOk({ displayName: await updateDisplayName(s.userId, parseText(body.displayName, "displayName", { min: 2, max: 60 })) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
