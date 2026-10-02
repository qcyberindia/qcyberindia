import type { NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, jsonOk } from "@/lib/fund/http";
import { parseEmail, readJsonObject } from "@/lib/fund/validation";
import { requestPasswordReset } from "@/lib/qfinera-auth/service";

/** Always the same answer, whether or not the email has an account. */
export async function POST(req: NextRequest) {
  try {
    assertJsonMutation(req);
    const body = await readJsonObject(req);
    await requestPasswordReset(parseEmail(body.email), requestMeta(req));
    return jsonOk({ message: "If an account uses that email, we've sent a link to set a new password." }, 202);
  } catch (err) {
    return toErrorResponse(err);
  }
}
