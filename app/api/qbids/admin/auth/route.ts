import { NextRequest, NextResponse } from "next/server";
import {
  QBIDS_ADMIN_COOKIE,
  QBIDS_ADMIN_MAX_AGE_SECONDS,
  createAdminCookieValue,
} from "@/lib/qbids-admin-auth";

export async function POST(req: NextRequest) {
  const adminPassword = process.env.QBIDS_ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { ok: false, error: "Admin access isn't configured yet (QBIDS_ADMIN_PASSWORD missing)." },
      { status: 503 }
    );
  }

  const { password } = await req.json().catch(() => ({ password: "" }));

  if (typeof password !== "string" || password !== adminPassword) {
    return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(QBIDS_ADMIN_COOKIE, createAdminCookieValue(adminPassword), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: QBIDS_ADMIN_MAX_AGE_SECONDS,
    path: "/",
  });

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(QBIDS_ADMIN_COOKIE);
  return res;
}
