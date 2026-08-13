import { NextRequest, NextResponse } from "next/server";
import { getQbidsRegistrations, updateQbidsRegistrationStatus, isDbConfigured } from "@/lib/db";
import { isValidAdminCookie, QBIDS_ADMIN_COOKIE } from "@/lib/qbids-admin-auth";

function requireAdmin(req: NextRequest): boolean {
  return isValidAdminCookie(req.cookies.get(QBIDS_ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ ok: true, registrations: [] });
  }

  try {
    const registrations = await getQbidsRegistrations();
    return NextResponse.json({ ok: true, registrations });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load registrations" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id, status } = await req.json().catch(() => ({}));

  if (typeof id !== "number" || typeof status !== "string") {
    return NextResponse.json({ ok: false, error: "id and status are required" }, { status: 400 });
  }

  const result = await updateQbidsRegistrationStatus(id, status);

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
