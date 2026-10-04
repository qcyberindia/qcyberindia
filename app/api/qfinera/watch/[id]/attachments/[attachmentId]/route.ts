import type { NextRequest } from "next/server";
import { requestMeta } from "@/lib/fund/audit";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { assertJsonMutation, jsonOk } from "@/lib/fund/http";
import { parseId } from "@/lib/fund/validation";
import { getWatchAttachmentFile, removeWatchAttachment, requireWatchActor } from "@/lib/watch/service";

type Params = { params: Promise<{ id: string; attachmentId: string }> };

/** The file, to signed-in accounts that can see the item. Verified type, sandboxed, never cached publicly. */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const db = readDb();
    const actor = await requireWatchActor(req, db);
    const p = await params;
    const file = await getWatchAttachmentFile(db, actor, parseId(p.id, "id"), parseId(p.attachmentId, "attachmentId"));
    const disposition = req.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new Response(new Uint8Array(file.data), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.data.length),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** Remove a file (author or ADMIN). The bytes stay in the database for audit; the file is no longer served. */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    assertJsonMutation(req);
    const db = readDb();
    const actor = await requireWatchActor(req, db);
    const p = await params;
    await removeWatchAttachment(actor, parseId(p.id, "id"), parseId(p.attachmentId, "attachmentId"), requestMeta(req));
    return jsonOk({ removed: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
