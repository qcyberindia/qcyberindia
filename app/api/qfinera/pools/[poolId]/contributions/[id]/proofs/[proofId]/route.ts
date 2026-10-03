import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { itemId, poolRoute } from "@/lib/fund/pool-http";
import { getContributionProofFile } from "@/lib/fund/services/contribution-proofs";
import { parseId } from "@/lib/fund/validation";

type Params = { params: Promise<{ poolId: string; id: string; proofId: string }> };

/**
 * The proof file, to the contributor or MANAGER/ADMIN only. Served with its
 * verified type, never sniffed, sandboxed, and not cached by shared caches.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const p = await params;
  return poolRoute(req, Promise.resolve(p), async ({ ctx, id }) => {
    const file = await getContributionProofFile(readDb(), ctx.actor, ctx.fund.id, itemId(id), parseId(p.proofId, "proofId"));
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
  });
}
