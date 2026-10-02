import { NextRequest, NextResponse } from "next/server";
import { countQbidsRegistrations, countQFinanceRegistrations, isDbConfigured } from "@/lib/db";
import { ADMIN_COOKIE, isValidAdminCookie } from "@/lib/admin-auth";
import { adminCountUsers } from "@/lib/qfinera-auth/admin";

export async function GET(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, qbids: 0, qfinance: 0, qfineraUsers: 0, dbConfigured: false });
  }

  try {
    const [qbids, qfinance, qfineraUsers] = await Promise.all([
      countQbidsRegistrations(),
      countQFinanceRegistrations(),
      // qfinance_users exists once the community/auth migrations are applied.
      adminCountUsers().catch(() => 0),
    ]);
    return NextResponse.json({ ok: true, qbids, qfinance, qfineraUsers, dbConfigured: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load overview" },
      { status: 500 }
    );
  }
}
