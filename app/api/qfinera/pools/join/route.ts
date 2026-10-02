import type { NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { requireActiveSession } from "@/lib/fund/auth";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, jsonOk } from "@/lib/fund/http";
import { acceptInvite, previewInvite } from "@/lib/fund/services/invites";
import { parseText, readJsonObject } from "@/lib/fund/validation";

/** What an invite link is for (pool name, role), for the signed-in invitee. */
export async function GET(req: NextRequest) {
  try {
    const session = await requireActiveSession(req);
    const token = req.nextUrl.searchParams.get("token") ?? "";
    return jsonOk({ invite: await previewInvite(readDb(), token, session.email) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** Accept an invite. Only the account whose email was invited can do this. */
export async function POST(req: NextRequest) {
  try {
    assertJsonMutation(req);
    const session = await requireActiveSession(req);
    const body = await readJsonObject(req);
    const token = parseText(body.token, "token", { max: 100 });
    const joined = await acceptInvite({ userId: session.userId, email: session.email, meta: requestMeta(req) }, token);
    return jsonOk(joined);
  } catch (err) {
    return toErrorResponse(err);
  }
}
