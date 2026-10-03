import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { MAX_PROOF_BYTES, addContributionProof } from "@/lib/fund/services/contribution-proofs";
import { parseText, readJsonObject } from "@/lib/fund/validation";

// base64 is 4/3 of the file, plus the JSON envelope.
const MAX_BODY = Math.ceil((MAX_PROOF_BYTES * 4) / 3) + 4096;

/** Attach a payment screenshot or PDF: { fileName, dataBase64 }. */
export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const body = await readJsonObject(req, MAX_BODY);
      const proof = await addContributionProof(sctx, itemId(id), {
        fileName: parseText(body.fileName, "fileName", { max: 300 }),
        dataBase64: typeof body.dataBase64 === "string" ? body.dataBase64 : "",
      });
      return jsonOk({ proof }, 201);
    },
    { mutation: true }
  );
}
