import { NextResponse, type NextRequest } from "next/server";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation } from "@/lib/fund/http";
import { sessionTokenFrom } from "@/lib/qfinera-auth/http";
import { clearedSessionCookie } from "@/lib/qfinera-auth/sessions";
import { logout } from "@/lib/qfinera-auth/service";

/** Revokes the session server-side (not just the cookie) and clears the cookie. */
export async function POST(req: NextRequest) {
  try {
    assertJsonMutation(req);
    await logout(sessionTokenFrom(req));
    const res = NextResponse.json({ ok: true, data: { signedOut: true } });
    res.cookies.set(clearedSessionCookie());
    return res;
  } catch (err) {
    return toErrorResponse(err);
  }
}
