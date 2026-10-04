// Shared helpers for QFinera Fund Route Handlers.
import { NextResponse, type NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { parseFundParam, type FundContext } from "@/lib/fund/auth";
import { FundError } from "@/lib/fund/errors";
import type { ServiceCtx } from "@/lib/fund/services/types";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true as const, data }, { status });
}

/** The fund the caller is ASKING for (?fund=ID). Only a request: membership decides. */
export function fundIdFrom(req: NextRequest): number | null {
  return parseFundParam(req.nextUrl.searchParams.get("fund"));
}

/**
 * CSRF defence for cookie-authenticated mutations (the session cookie is
 * SameSite=Lax, which already blocks most cross-site POSTs):
 *   1. the body must be JSON, so a plain cross-site <form> cannot send it, and
 *      a cross-site fetch needs a CORS preflight this API never approves;
 *   2. if the browser sent an Origin header, its host must be one of this
 *      request's own hosts (Host / X-Forwarded-Host behind the reverse proxy).
 */
export function assertJsonMutation(req: NextRequest): void {
  const type = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!type.startsWith("application/json")) {
    throw new FundError("VALIDATION", "Requests must be sent as JSON.", 415);
  }
  const origin = req.headers.get("origin");
  if (!origin) return;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new FundError("FORBIDDEN", "Cross-origin requests are not allowed.", 403);
  }
  const own = [req.headers.get("host"), req.headers.get("x-forwarded-host"), req.nextUrl.host].filter(
    (h): h is string => Boolean(h)
  );
  if (!own.includes(originHost)) {
    throw new FundError("FORBIDDEN", "Cross-origin requests are not allowed.", 403);
  }
}

export function serviceCtx(ctx: FundContext, req: Request): ServiceCtx {
  return { fundId: ctx.fund.id, actor: ctx.actor, meta: requestMeta(req) };
}

/** Route params arrive as a Promise in Next.js 16. */
export type IdParams = { params: Promise<{ id: string }> };

/**
 * Response for an ADMIN-only change made through actOrPropose(): the
 * result when it was applied, or 202 + the pending request when a MANAGER
 * proposed it (nothing has changed yet).
 */
export function actionResponse(
  r: { kind: "done"; data: unknown } | { kind: "proposed"; request: unknown },
  status = 200
) {
  return r.kind === "proposed" ? jsonOk({ pendingApproval: true as const, request: r.request }, 202) : jsonOk(r.data, status);
}
