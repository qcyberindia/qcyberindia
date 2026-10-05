import type { NextRequest } from "next/server";
import { validationError } from "@/lib/fund/errors";
import { jsonOk } from "@/lib/fund/http";
import { itemId, poolRoute, type PoolItemParams } from "@/lib/fund/pool-http";
import { MAX_PROOF_BYTES, PROOF_KINDS, addContributionProof, type ProofKind } from "@/lib/fund/services/contribution-proofs";
import { parseEnum, parseText, readJsonObject } from "@/lib/fund/validation";

// base64 is 4/3 of the file, plus the JSON envelope.
const MAX_BODY = Math.ceil((MAX_PROOF_BYTES * 4) / 3) + 4096;
// Raw file plus the multipart envelope.
const MAX_MULTIPART = MAX_PROOF_BYTES + 16 * 1024;

function parseKind(raw: unknown): ProofKind {
  return raw === undefined || raw === null || raw === "" ? "PAYMENT" : parseEnum(raw, "kind", PROOF_KINDS);
}

/**
 * Attach a proof file. kind PAYMENT (the default) is the contributor's
 * payment proof; RECEIVED is a manager's or administrator's received /
 * verified proof. Two encodings:
 *   multipart/form-data  file, kind?   (the app: raw bytes, no base64 overhead)
 *   application/json     { fileName, dataBase64, kind? }
 * Either way the server checks the real file type, size and permissions.
 */
export async function POST(req: NextRequest, { params }: PoolItemParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx, id }) => {
      const type = (req.headers.get("content-type") ?? "").toLowerCase();
      if (type.startsWith("multipart/form-data")) {
        const declared = Number(req.headers.get("content-length") ?? "0");
        if (declared > MAX_MULTIPART) throw validationError("The file is larger than 2 MB.", { file: "Larger than 2 MB" });
        let form: FormData;
        try {
          form = await req.formData();
        } catch {
          throw validationError("The file could not be read.", { file: "Invalid upload" });
        }
        const file = form.get("file");
        if (!file || typeof file === "string") throw validationError("Choose a file to upload.", { file: "Required" });
        if (file.size > MAX_PROOF_BYTES) throw validationError("The file is larger than 2 MB.", { file: "Larger than 2 MB" });
        const proof = await addContributionProof(sctx, itemId(id), {
          fileName: parseText(file.name || "proof", "fileName", { max: 300 }),
          bytes: Buffer.from(await file.arrayBuffer()),
          kind: parseKind(form.get("kind")),
        });
        return jsonOk({ proof }, 201);
      }
      const body = await readJsonObject(req, MAX_BODY);
      const proof = await addContributionProof(sctx, itemId(id), {
        fileName: parseText(body.fileName, "fileName", { max: 300 }),
        dataBase64: typeof body.dataBase64 === "string" ? body.dataBase64 : "",
        kind: parseKind(body.kind),
      });
      return jsonOk({ proof }, 201);
    },
    { mutation: true, allowMultipart: true }
  );
}
