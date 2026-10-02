import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { isDbConfigured } from "@/lib/db";
import { requestMeta } from "@/lib/fund/audit";
import { readDb } from "@/lib/fund/db";
import { countAttempts, record } from "@/lib/qfinera-auth/rate-limit";
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

  // Brute-force protection: at most 10 failed attempts per IP per 15 minutes.
  const bucket = `admin-login-fail:ip:${requestMeta(req).ip ?? "unknown"}`;
  const limited = isDbConfigured();
  if (limited && (await countAttempts(readDb(), bucket, 15).catch(() => 0)) >= 10) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { password } = await req.json().catch(() => ({ password: "" }));

  // Constant-time comparison (of fixed-length digests, so length is not leaked either).
  const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
  if (typeof password !== "string" || !timingSafeEqual(digest(password), digest(adminPassword))) {
    if (limited) await record(readDb(), bucket).catch(() => undefined);
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
