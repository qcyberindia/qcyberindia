import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidAdminCookie } from "@/lib/admin-auth";

// Lightweight "am I logged in" check the unified admin shell uses to decide
// whether to show the login form or the dashboard — independent of any
// particular section's data, so Overview/Qbids/QFinance all share one gate.
export async function GET(req: NextRequest) {
  const authed = isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value);
  return NextResponse.json({ ok: authed }, { status: authed ? 200 : 401 });
}
