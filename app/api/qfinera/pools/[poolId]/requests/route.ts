import type { NextRequest } from "next/server";
import { listChangeRequests } from "@/lib/fund/change-request-store";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { FUND_ACTIONS, requestVisibility } from "@/lib/fund/services/change-requests";
import { parseEnum } from "@/lib/fund/validation";

/** Approvals queue. ADMIN sees every request in the pool; a MANAGER sees their own. */
export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ req, sctx }) => {
    const { requestedBy } = requestVisibility(sctx);
    const status = parseEnum(req.nextUrl.searchParams.get("status") ?? "all", "status", ["open", "closed", "all"] as const);
    const requests = await listChangeRequests(readDb(), { scope: "fund", fundId: sctx.fundId, status, requestedBy, limit: 100 });
    return jsonOk({
      requests: requests.map((r) => ({ ...r, label: FUND_ACTIONS[r.action]?.label ?? r.action })),
    });
  });
}
