import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import type { FundMembershipStatus, FundRole } from "@/lib/fund/rbac";
import { updateMember } from "@/lib/fund/services/members";
import { parseEnum, parseOptionalText, readJsonObject } from "@/lib/fund/validation";

const ROLES: readonly FundRole[] = ["ADMIN", "MANAGER", "MEMBER"];
const STATUSES: readonly FundMembershipStatus[] = ["active", "suspended", "removed"];

/** ADMIN: change role, suspend/reactivate, or remove (id = the member's user id). */
export async function PATCH(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req);
      const member = await updateMember(sctx, itemId(id), {
        role: body.role === undefined ? undefined : parseEnum(body.role, "role", ROLES),
        status: body.status === undefined ? undefined : parseEnum(body.status, "status", STATUSES),
        reason: parseOptionalText(body.reason, "reason", 500),
      });
      return jsonOk({ member });
    },
    { mutation: true }
  );
}
