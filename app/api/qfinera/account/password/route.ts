import { NextResponse, type NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation } from "@/lib/fund/http";
import { readJsonObject } from "@/lib/fund/validation";
import { requireRequestSession } from "@/lib/qfinera-auth/http";
import { sessionCookie } from "@/lib/qfinera-auth/sessions";
import { changePassword } from "@/lib/qfinera-auth/service";

/** Needs the current password. Signs out all other sessions and rotates this one. */
export async function POST(req: NextRequest) {
  try {
    assertJsonMutation(req);
    const s = await requireRequestSession(req);
    const body = await readJsonObject(req);
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    const fresh = await changePassword(
      s,
      { currentPassword: str(body.currentPassword), password: str(body.password), confirmPassword: str(body.confirmPassword) },
      requestMeta(req)
    );
    const res = NextResponse.json({ ok: true, data: { changed: true } });
    res.cookies.set(sessionCookie(fresh.token, fresh.expiresAt));
    return res;
  } catch (err) {
    return toErrorResponse(err);
  }
}
