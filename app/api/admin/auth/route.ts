import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_MAX_AGE_SECONDS,
  createAdminCookieValue,
  getAdminSecret,
} from "@/lib/admin-auth";

export async function POST(req: NextRequest) {
  const adminPassword = getAdminSecret();

  if (!adminPassword) {
    return NextResponse.json(
      { ok: false, error: "QCyberIndia admin authentication isn't configured yet (QCYBERINDIA_ADMIN_PASSWORD missing)." },
      { status: 503 }
    );
  }

  const { password } = await req.json().catch(() => ({ password: "" }));

  if (typeof password !== "string" || password !== adminPassword) {
    return NextResponse.json({ ok: false, error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, createAdminCookieValue(adminPassword), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ADMIN_MAX_AGE_SECONDS,
    path: "/",
  });

  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
