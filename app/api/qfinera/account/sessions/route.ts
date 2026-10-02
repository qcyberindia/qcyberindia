import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { notFoundError, toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, jsonOk } from "@/lib/fund/http";
import { parseOptionalId, readJsonObject } from "@/lib/fund/validation";
import { requireRequestSession } from "@/lib/qfinera-auth/http";
import { revokeUserSessions } from "@/lib/qfinera-auth/sessions";

/** Sign out one of MY other sessions ({ sessionId }) or all of them except this one ({ all: true }). */
export async function POST(req: NextRequest) {
  try {
    assertJsonMutation(req);
    const s = await requireRequestSession(req);
    const body = await readJsonObject(req);
    const db = readDb();
    if (body.all === true) {
      return jsonOk({ revoked: await revokeUserSessions(db, s.userId, "user-signed-out-others", s.sessionId) });
    }
    const id = parseOptionalId(body.sessionId, "sessionId");
    if (!id || id === s.sessionId) throw notFoundError("Session");
    // user_id in the WHERE clause: another user's session id is simply "not found".
    const res = await db.query(
      "UPDATE qfinance_sessions SET revoked_at = now(), revoked_reason = 'user' WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL",
      [id, s.userId]
    );
    if (res.rowCount !== 1) throw notFoundError("Session");
    return jsonOk({ revoked: 1 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
