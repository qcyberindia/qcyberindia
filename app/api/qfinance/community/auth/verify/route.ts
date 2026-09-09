import { NextRequest, NextResponse } from "next/server";

import { getOrCreateQFinanceUser } from "@/lib/db";
import {
  verifyMagicLinkToken,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/qfinance-community-auth";
import { qfinanceConfig } from "@/lib/qfinance-config";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const redirectParam = req.nextUrl.searchParams.get("redirect");

  const destination =
    redirectParam && redirectParam.startsWith("/qfinance/")
      ? redirectParam
      : "/qfinance/community";

  const appUrl = qfinanceConfig.appUrl.replace(/\/$/, "");

  if (!token) {
    return NextResponse.redirect(
      new URL(`${appUrl}${destination}?auth=invalid`),
    );
  }

  const payload = verifyMagicLinkToken(token);

  if (!payload) {
    return NextResponse.redirect(
      new URL(`${appUrl}${destination}?auth=expired`),
    );
  }

  const user = await getOrCreateQFinanceUser(
    payload.email,
    payload.displayName,
  );

  if (!user) {
    return NextResponse.redirect(
      new URL(`${appUrl}${destination}?auth=error`),
    );
  }

  const sessionToken = createSessionToken({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
  });

  if (!sessionToken) {
    return NextResponse.redirect(
      new URL(`${appUrl}${destination}?auth=error`),
    );
  }

  const res = NextResponse.redirect(
    new URL(`${appUrl}${destination}?auth=success`),
  );

  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  return res;
}