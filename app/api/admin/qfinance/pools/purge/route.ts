import type { NextRequest } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse, unavailableError } from "@/lib/fund/errors";
import { jsonOk } from "@/lib/fund/http";
import { purgeExpiredPools } from "@/lib/fund/pool-purge";

/** QCyberIndia admin: pools scheduled for deletion and when each will be purged. */
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const { rows } = await readDb().query<{ id: number; name: string; deleted_at: Date; purge_after: Date; due: boolean }>(
      `SELECT id, name, deleted_at, purge_after, purge_after <= now() AS due FROM qfinera_funds
        WHERE deleted_at IS NOT NULL ORDER BY purge_after`
    );
    return jsonOk({ pools: rows.map((r) => ({ id: r.id, name: r.name, deletedAt: r.deleted_at, purgeAfter: r.purge_after, due: r.due })) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * QCyberIndia admin: permanently purge every pool whose 30-day retention has
 * ended (the same job as `node scripts/purge-deleted-pools.ts --apply`).
 * Pools still in retention, restored pools and active pools are never touched.
 */
export async function POST(req: NextRequest) {
  try {
    requireAdmin(req, { mutation: true });
    const pool = getDbPool();
    if (!pool) throw unavailableError("The database is not configured.");
    const client = await pool.connect();
    try {
      return jsonOk(await purgeExpiredPools(client));
    } finally {
      client.release();
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}
