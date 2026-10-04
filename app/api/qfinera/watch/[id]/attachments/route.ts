import type { NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, jsonOk } from "@/lib/fund/http";
import { parseId, parseText, readJsonObject } from "@/lib/fund/validation";
import { addWatchAttachment, requireWatchActor } from "@/lib/watch/service";

type Params = { params: Promise<{ id: string }> };

/** Attach a screenshot, image or PDF (author or ADMIN). Body: { fileName, data: base64 }. ~2.8 MB request limit. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    assertJsonMutation(req);
    const db = readDb();
    const actor = await requireWatchActor(req, db);
    const id = parseId((await params).id, "id");
    const body = await readJsonObject(req, 3 * 1024 * 1024);
    const attachment = await addWatchAttachment(
      actor,
      id,
      { fileName: parseText(body.fileName, "fileName", { min: 1, max: 300 }), dataBase64: parseText(body.data, "data", { min: 4, max: 3 * 1024 * 1024 }) },
      requestMeta(req)
    );
    return jsonOk({ attachment }, 201);
  } catch (err) {
    return toErrorResponse(err);
  }
}
