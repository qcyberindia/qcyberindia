import { NextRequest, NextResponse } from "next/server";
import { getOrCreateQFinanceUser } from "@/lib/db";
import {
  verifyMagicLinkToken,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/qfinance-community-auth";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const redirectParam = req.nextUrl.searchParams.get("redirect");
  const destination =
    redirectParam && redirectParam.startsWith("/qfinance/") ? redirectParam : "/qfinance/community";

  if (!token) {
    return NextResponse.redirect(new URL("/qfinance/community?auth=invalid", req.url));
  }

  const payload = verifyMagicLinkToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/qfinance/community?auth=expired", req.url));
  }

  const user = await getOrCreateQFinanceUser(payload.email, payload.displayName);
  if (!user) {
    return NextResponse.redirect(new URL("/qfinance/community?auth=error", req.url));
  }

  const sessionToken = createSessionToken({ id: user.id, email: user.email, displayName: user.display_name });
  if (!sessionToken) {
    return NextResponse.redirect(new URL("/qfinance/community?auth=error", req.url));
  }

  const res = NextResponse.redirect(new URL(`${destination}?auth=success`, req.url));
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
