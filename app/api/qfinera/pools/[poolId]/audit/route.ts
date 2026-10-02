import type { NextRequest } from "next/server";
import { listAudit } from "@/lib/fund/audit";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { parseOptionalId, parseOptionalIsoDate, parseOptionalText, parsePaging } from "@/lib/fund/validation";

/** ADMIN: this pool's append-only audit log. */
export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, ctx }) => {
    assertPermission(ctx.actor, "audit:view");
    const sp = req.nextUrl.searchParams;
    const { page, pageSize, offset } = parsePaging(sp, { pageSize: 50, maxPageSize: 100 });
    const entityType = parseOptionalText(sp.get("entityType"), "entityType", 40);
    const action = parseOptionalText(sp.get("action"), "action", 60);
    const { rows, total } = await listAudit(readDb(), ctx.fund.id, {
      entityType,
      entityId: parseOptionalId(sp.get("entityId"), "entityId"),
      action,
      userId: parseOptionalId(sp.get("user"), "user"),
      from: parseOptionalIsoDate(sp.get("from"), "from"),
      to: parseOptionalIsoDate(sp.get("to"), "to"),
      pageSize,
      offset,
    });
    return jsonOk({ audit: rows, page, pageSize, total });
  });
}
