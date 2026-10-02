// Shared plumbing for /api/qfinera/pools/[poolId]/... Route Handlers.
//
// Every pool request goes through poolRoute(), which:
//   1. for mutations, enforces JSON + same-origin (assertJsonMutation);
//   2. parses the pool id from the PATH (never a default pool);
//   3. resolves the caller's membership of THAT pool from the database
//      (requireFundContext): a non-member, a removed member, or a malformed
//      id gets 404, so pool existence never leaks; a suspended member 403;
//   4. converts any thrown error to a safe JSON response.
// Role checks happen in the services, again on every call.
import type { NextRequest } from "next/server";
import { requireFundContext, type FundContext } from "@/lib/fund/auth";
import { notFoundError, toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, serviceCtx } from "@/lib/fund/http";
import type { ServiceCtx } from "@/lib/fund/services/types";
import { parseId } from "@/lib/fund/validation";

export type PoolParams = { params: Promise<{ poolId: string }> };
export type PoolItemParams = { params: Promise<{ poolId: string; id: string }> };

export type PoolHandlerArgs = {
  req: NextRequest;
  ctx: FundContext;
  sctx: ServiceCtx;
  /** The [id] segment, parsed, for item routes; null otherwise. */
  id: number | null;
};

function parsePoolId(raw: string | undefined): number {
  // A malformed pool id is indistinguishable from someone else's pool.
  if (!raw || !/^\d{1,9}$/.test(raw)) throw notFoundError("Pool");
  return Number(raw);
}

export async function poolRoute(
  req: NextRequest,
  params: Promise<{ poolId: string; id?: string }>,
  handler: (args: PoolHandlerArgs) => Promise<Response>,
  opts: { mutation?: boolean } = {}
): Promise<Response> {
  try {
    if (opts.mutation) assertJsonMutation(req);
    const p = await params;
    const poolId = parsePoolId(p.poolId);
    const ctx = await requireFundContext(req, poolId);
    const id = p.id === undefined ? null : parseId(p.id, "id");
    return await handler({ req, ctx, sctx: serviceCtx(ctx, req), id });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** The id from an item route; poolRoute guarantees it for [id] routes. */
export function itemId(id: number | null): number {
  if (id === null) throw notFoundError();
  return id;
}
