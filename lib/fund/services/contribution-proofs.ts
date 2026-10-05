// Proof files for contributions (migrations 013, 014). Two kinds:
//
//   PAYMENT   "Payment proof": the contributor's evidence that they paid.
//             Attached by the contributor (or the manager who recorded the
//             contribution on their behalf) while it is pending or approved.
//   RECEIVED  "Received / verified proof": an ADMIN's or MANAGER's evidence
//             that the money arrived, checked against the pool's bank
//             statement. Attached from the review workflow, until finalized.
//
// Stored in the database, never behind a public URL. Only the contributor
// and roles that see every contribution (MANAGER/ADMIN) can list or
// download them. A file is accepted only when its CONTENT is a PNG, JPEG,
// WebP or PDF (magic bytes), whatever name or type the browser claimed, and
// is served back with that verified type. Proofs are append-only: a wrong
// file is superseded by uploading another.
import { createHash } from "node:crypto";
import { writeAudit } from "@/lib/fund/audit";
import { inTransaction, one, type Db } from "@/lib/fund/db";
import { conflictError, notFoundError, validationError } from "@/lib/fund/errors";
import { ForbiddenError, canViewMemberRecord, hasPermission, type FundActor } from "@/lib/fund/rbac";
import type { ServiceCtx } from "@/lib/fund/services/types";

export const MAX_PROOF_BYTES = 2 * 1024 * 1024;
export type ProofKind = "PAYMENT" | "RECEIVED";
export const PROOF_KINDS: readonly ProofKind[] = ["PAYMENT", "RECEIVED"];

/** When each kind may be attached. */
const OPEN_STATUSES: Record<ProofKind, readonly string[]> = {
  PAYMENT: ["PENDING", "APPROVED"],
  RECEIVED: ["PENDING", "APPROVED", "AWAITING_NAV", "FINALIZED"],
};

export type ProofContentType = "image/png" | "image/jpeg" | "image/webp" | "application/pdf";

export type ProofMeta = {
  id: number;
  kind: ProofKind;
  fileName: string;
  contentType: ProofContentType;
  sizeBytes: number;
  uploadedBy: number;
  uploaderName: string | null;
  createdAt: Date;
};

/** The real type of the bytes, or null if it is not an accepted format. */
export function sniffProofType(bytes: Uint8Array): ProofContentType | null {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  return null;
}

/** Keeps a display name only: no path, no control characters. */
export function cleanFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, "").trim().slice(0, 200);
  return cleaned || "proof";
}

/** Size checks shared by both upload encodings. */
export function checkProofSize(bytes: Buffer): Buffer {
  if (bytes.length === 0) throw validationError("The file is empty.", { file: "Empty file" });
  if (bytes.length > MAX_PROOF_BYTES) throw validationError("The file is larger than 2 MB.", { file: "Larger than 2 MB" });
  return bytes;
}

/** Decodes base64 strictly. */
export function decodeProof(dataBase64: string): Buffer {
  const b64 = dataBase64.replace(/^data:[^;]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) throw validationError("The file could not be read.", { file: "Invalid file data" });
  return checkProofSize(Buffer.from(b64, "base64"));
}

async function loadContribution(db: Db, fundId: number, id: number) {
  return one<{ id: number; member_id: number; created_by: number; status: string }>(
    db,
    "SELECT id, member_id, created_by, status FROM qfinera_fund_contributions WHERE id = $1 AND fund_id = $2",
    [id, fundId]
  );
}

function canSee(actor: FundActor, memberId: number): boolean {
  return canViewMemberRecord(actor, memberId, "contributions");
}

export async function addContributionProof(
  ctx: ServiceCtx,
  contributionId: number,
  input: { fileName: string; kind: ProofKind } & ({ dataBase64: string } | { bytes: Buffer })
): Promise<ProofMeta> {
  const bytes = "bytes" in input ? checkProofSize(input.bytes) : decodeProof(input.dataBase64);
  const contentType = sniffProofType(bytes);
  if (!contentType) {
    throw validationError("Upload a PNG, JPEG or WebP screenshot, or a PDF.", { file: "Unsupported file type" });
  }
  const fileName = cleanFileName(input.fileName);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  return inTransaction(async (db) => {
    const c = await loadContribution(db, ctx.fundId, contributionId);
    if (!c || !canSee(ctx.actor, c.member_id)) throw notFoundError("Contribution");
    if (input.kind === "PAYMENT") {
      // The contributor, or the manager/admin who recorded it for them.
      const onBehalf = c.created_by === ctx.actor.userId && hasPermission(ctx.actor, "contributions:create_for_member");
      if (c.member_id !== ctx.actor.userId && !onBehalf) {
        throw new ForbiddenError("Only the contributor attaches payment proof. Attach a received / verified proof instead.");
      }
    } else if (!hasPermission(ctx.actor, "contributions:view_all")) {
      throw new ForbiddenError("Only a manager or administrator attaches received / verified proof.");
    }
    if (!OPEN_STATUSES[input.kind].includes(c.status)) {
      throw conflictError(
        input.kind === "PAYMENT"
          ? `Payment proof can only be added before funds are confirmed (this contribution is ${c.status}).`
          : `Received proof can no longer be added: this contribution is ${c.status}.`
      );
    }
    const dup = await one<{ id: number }>(
      db,
      "SELECT id FROM qfinera_fund_contribution_proofs WHERE fund_id = $1 AND contribution_id = $2 AND sha256 = $3",
      [ctx.fundId, contributionId, sha256]
    );
    if (dup) throw conflictError("This file is already attached to the contribution.");
    const row = await one<{ id: number; created_at: Date }>(
      db,
      `INSERT INTO qfinera_fund_contribution_proofs
         (fund_id, contribution_id, file_name, content_type, size_bytes, sha256, data, uploaded_by, kind)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, created_at`,
      [ctx.fundId, contributionId, fileName, contentType, bytes.length, sha256, bytes, ctx.actor.userId, input.kind]
    );
    if (!row) throw new Error("proof insert returned no row");
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: input.kind === "PAYMENT" ? "contribution.proof_added" : "contribution.received_proof_added",
      entityType: "contribution",
      entityId: contributionId,
      after: { proof_id: row.id, kind: input.kind, file_name: fileName, content_type: contentType, size_bytes: bytes.length, sha256 },
      meta: ctx.meta,
    });
    return {
      id: row.id,
      kind: input.kind,
      fileName,
      contentType,
      sizeBytes: bytes.length,
      uploadedBy: ctx.actor.userId,
      uploaderName: null,
      createdAt: row.created_at,
    };
  });
}

/** Proof metadata (no bytes) for a contribution the caller may already see. */
export async function listContributionProofs(db: Db, fundId: number, contributionId: number): Promise<ProofMeta[]> {
  const { rows } = await db.query<ProofMeta>(
    `SELECT p.id, p.kind, p.file_name AS "fileName", p.content_type AS "contentType", p.size_bytes AS "sizeBytes",
            p.uploaded_by AS "uploadedBy", u.display_name AS "uploaderName", p.created_at AS "createdAt"
       FROM qfinera_fund_contribution_proofs p
       LEFT JOIN qfinance_users u ON u.id = p.uploaded_by
      WHERE p.fund_id = $1 AND p.contribution_id = $2
      ORDER BY p.id`,
    [fundId, contributionId]
  );
  return rows;
}

export async function getContributionProofFile(
  db: Db,
  actor: FundActor,
  fundId: number,
  contributionId: number,
  proofId: number
): Promise<{ fileName: string; contentType: ProofContentType; data: Buffer }> {
  const c = await loadContribution(db, fundId, contributionId);
  if (!c || !canSee(actor, c.member_id)) throw notFoundError("Proof");
  const row = await one<{ file_name: string; content_type: ProofContentType; data: Buffer }>(
    db,
    "SELECT file_name, content_type, data FROM qfinera_fund_contribution_proofs WHERE id = $1 AND fund_id = $2 AND contribution_id = $3",
    [proofId, fundId, contributionId]
  );
  if (!row) throw notFoundError("Proof");
  return { fileName: row.file_name, contentType: row.content_type, data: row.data };
}
