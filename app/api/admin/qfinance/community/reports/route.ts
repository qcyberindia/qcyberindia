import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isValidAdminCookie } from "@/lib/admin-auth";
import { adminListQFinanceCommunityReports, adminResolveQFinanceCommunityReport } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const reports = await adminListQFinanceCommunityReports();
  return NextResponse.json({ ok: true, reports });
}

export async function PATCH(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id, status } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id) || (status !== "resolved" && status !== "dismissed")) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const result = await adminResolveQFinanceCommunityReport(id, status, "admin");
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
