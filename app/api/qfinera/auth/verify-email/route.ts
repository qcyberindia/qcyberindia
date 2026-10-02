import { NextResponse, type NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation } from "@/lib/fund/http";
import { readJsonObject } from "@/lib/fund/validation";
import { sessionCookie } from "@/lib/qfinera-auth/sessions";
import { verifyEmail } from "@/lib/qfinera-auth/service";

/** Confirms the email (token + the password chosen at registration) and signs the user in. */
export async function POST(req: NextRequest) {
  try {
    assertJsonMutation(req);
    const body = await readJsonObject(req);
    const { session } = await verifyEmail(
      { token: typeof body.token === "string" ? body.token : "", password: typeof body.password === "string" ? body.password : "" },
      requestMeta(req)
    );
    const res = NextResponse.json({ ok: true, data: { signedIn: true } });
    res.cookies.set(sessionCookie(session.token, session.expiresAt));
    return res;
  } catch (err) {
    return toErrorResponse(err);
  }
}
