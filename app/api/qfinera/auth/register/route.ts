import type { NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, jsonOk } from "@/lib/fund/http";
import { parseEmail, parseText, readJsonObject } from "@/lib/fund/validation";
import { register } from "@/lib/qfinera-auth/service";

/** Same response whether or not the email is already registered (no account enumeration). */
export async function POST(req: NextRequest) {
  try {
    assertJsonMutation(req);
    const body = await readJsonObject(req);
    await register(
      {
        displayName: parseText(body.displayName, "displayName", { min: 2, max: 60 }),
        email: parseEmail(body.email),
        password: typeof body.password === "string" ? body.password : "",
        confirmPassword: typeof body.confirmPassword === "string" ? body.confirmPassword : "",
        acceptTerms: body.acceptTerms === true,
      },
      requestMeta(req)
    );
    return jsonOk({ message: "Check your email for a link to confirm your account." }, 202);
  } catch (err) {
    return toErrorResponse(err);
  }
}
