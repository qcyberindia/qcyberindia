import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { editMessage, removeMessage } from "@/lib/fund/services/chat";
import { parseEnum, parseOptionalText, readJsonObject } from "@/lib/fund/validation";

/**
 * { action: "edit", body }         the author edits their own message
 * { action: "remove", reason? }    the author removes their own message, or
 *                                  an ADMIN removes anyone's (reason required)
 */
export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req, 16 * 1024);
      const action = parseEnum(body.action, "action", ["edit", "remove"] as const);
      const message =
        action === "edit"
          ? await editMessage(sctx, itemId(id), body.body)
          : await removeMessage(sctx, itemId(id), parseOptionalText(body.reason, "reason", 500));
      return jsonOk({ message });
    },
    { mutation: true }
  );
}
