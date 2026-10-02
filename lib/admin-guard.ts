// Request guard for QCyberIndia admin API routes that read or change
// QFinera accounts: the existing centralized admin cookie, plus same-origin
// JSON for mutations. No second admin authentication system.
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidAdminCookie } from "@/lib/admin-auth";
import { FundError } from "@/lib/fund/errors";
import { assertJsonMutation } from "@/lib/fund/http";

export function requireAdmin(req: NextRequest, opts: { mutation?: boolean } = {}): void {
  if (opts.mutation) assertJsonMutation(req);
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    throw new FundError("UNAUTHENTICATED", "Unauthorized", 401);
  }
}
