import { NextResponse, type NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation } from "@/lib/fund/http";
import { readJsonObject } from "@/lib/fund/validation";
import { clearedSessionCookie } from "@/lib/qfinera-auth/sessions";
import { resetPassword } from "@/lib/qfinera-auth/service";

/** Sets the new password, signs out every session, and asks the user to sign in again. */
export async function POST(req: NextRequest) {
  try {
    assertJsonMutation(req);
    const body = await readJsonObject(req);
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    await resetPassword({ token: str(body.token), password: str(body.password), confirmPassword: str(body.confirmPassword) }, requestMeta(req));
    const res = NextResponse.json({ ok: true, data: { reset: true } });
    res.cookies.set(clearedSessionCookie());
    return res;
  } catch (err) {
    return toErrorResponse(err);
  }
}
