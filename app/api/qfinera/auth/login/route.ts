import { NextResponse, type NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation } from "@/lib/fund/http";
import { readJsonObject } from "@/lib/fund/validation";
import { sessionTokenFrom } from "@/lib/qfinera-auth/http";
import { sessionCookie } from "@/lib/qfinera-auth/sessions";
import { login } from "@/lib/qfinera-auth/service";

export async function POST(req: NextRequest) {
  try {
    assertJsonMutation(req);
    const body = await readJsonObject(req);
    const email = typeof body.email === "string" ? body.email.slice(0, 254) : "";
    const password = typeof body.password === "string" ? body.password.slice(0, 256) : "";
    const session = await login({ email, password, previousToken: sessionTokenFrom(req) }, requestMeta(req));
    const res = NextResponse.json({ ok: true, data: { signedIn: true } });
    res.cookies.set(sessionCookie(session.token, session.expiresAt));
    return res;
  } catch (err) {
    return toErrorResponse(err);
  }
}
