import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { requestMeta } from "@/lib/fund/audit";
import { toErrorResponse } from "@/lib/fund/errors";
import { jsonOk } from "@/lib/fund/http";
import { parseEnum, parseId, parseText, readJsonObject } from "@/lib/fund/validation";
import { adminGetUser } from "@/lib/qfinera-auth/admin";
import { adminRevokeSessions, adminSendPasswordReset, adminSetUserStatus } from "@/lib/qfinera-auth/service";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    requireAdmin(req);
    return jsonOk(await adminGetUser(parseId((await params).id, "id")));
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** suspend | restore | revoke-sessions | send-password-reset. Every action is recorded. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    requireAdmin(req, { mutation: true });
    const id = parseId((await params).id, "id");
    const body = await readJsonObject(req);
    const ip = requestMeta(req).ip;
    const action = parseEnum(body.action, "action", ["suspend", "restore", "revoke-sessions", "send-password-reset"] as const);
    const reason = () => parseText(body.reason, "reason", { min: 3, max: 500 });
    switch (action) {
      case "suspend":
        await adminSetUserStatus(id, "suspended", reason(), ip);
        break;
      case "restore":
        await adminSetUserStatus(id, "active", reason(), ip);
        break;
      case "revoke-sessions":
        await adminRevokeSessions(id, reason(), ip);
        break;
      case "send-password-reset":
        await adminSendPasswordReset(id, ip);
        break;
    }
    return jsonOk(await adminGetUser(id));
  } catch (err) {
    return toErrorResponse(err);
  }
}
