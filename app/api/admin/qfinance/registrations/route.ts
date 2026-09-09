import { NextRequest, NextResponse } from "next/server";
import { getQFinanceRegistrations, isDbConfigured } from "@/lib/db";
import { ADMIN_COOKIE, isValidAdminCookie } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, registrations: [] });
  }

  try {
    const registrations = await getQFinanceRegistrations();
    return NextResponse.json({ ok: true, registrations });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load registrations" },
      { status: 500 }
    );
  }
}
