// Permanent purge of pools whose 30-day deletion retention has ended.
//
// Self-contained on purpose (no "@/" imports): it is used by the app (the
// QCyberIndia admin endpoint) AND by `node scripts/purge-deleted-pools.ts`,
// which runs with Node's native TypeScript support and no path aliases.
//
// Safety, in layers:
//   1. Only pools with deleted_at set and purge_after <= now() are selected.
//   2. Each pool is purged in its own transaction that first re-locks the
//      pool row and re-checks that condition (a pool restored a moment ago
//      is skipped).
//   3. The database itself refuses: the append-only triggers and the pool
//      delete guard (migration 015) allow a DELETE only when the
//      transaction names that pool in qfinera.purge_fund_id AND the pool is
//      deleted and past retention. An active pool cannot be purged even by
//      a bug in this file.
// A tombstone (pool id, name, who deleted it, when) is written to the
// append-only qfinance_admin_audit, which has no foreign key to the pool.

export type PurgeClient = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>;
};

/** Deletion order: children before parents. Every statement is scoped to one pool. */
export const PURGE_STEPS: ReadonlyArray<{ table: string; sql: string }> = [
  {
    table: "qfinera_fund_watchlist_comments",
    sql: `DELETE FROM qfinera_fund_watchlist_comments
           WHERE watchlist_item_id IN (SELECT id FROM qfinera_fund_watchlist_items WHERE fund_id = $1)`,
  },
  { table: "qfinera_fund_watchlist_items", sql: "DELETE FROM qfinera_fund_watchlist_items WHERE fund_id = $1" },
  { table: "qfinera_fund_messages", sql: "DELETE FROM qfinera_fund_messages WHERE fund_id = $1" },
  { table: "qfinera_fund_contribution_proofs", sql: "DELETE FROM qfinera_fund_contribution_proofs WHERE fund_id = $1" },
  { table: "qfinera_fund_trade_revisions", sql: "DELETE FROM qfinera_fund_trade_revisions WHERE fund_id = $1" },
  { table: "qfinera_fund_ledger_entries", sql: "DELETE FROM qfinera_fund_ledger_entries WHERE fund_id = $1" },
  { table: "qfinera_fund_contributions", sql: "DELETE FROM qfinera_fund_contributions WHERE fund_id = $1" },
  { table: "qfinera_fund_withdrawals", sql: "DELETE FROM qfinera_fund_withdrawals WHERE fund_id = $1" },
  { table: "qfinera_fund_expenses", sql: "DELETE FROM qfinera_fund_expenses WHERE fund_id = $1" },
  { table: "qfinera_fund_trades", sql: "DELETE FROM qfinera_fund_trades WHERE fund_id = $1" },
  { table: "qfinera_fund_price_snapshots", sql: "DELETE FROM qfinera_fund_price_snapshots WHERE fund_id = $1" },
  { table: "qfinera_fund_nav_snapshots", sql: "DELETE FROM qfinera_fund_nav_snapshots WHERE fund_id = $1" },
  { table: "qfinera_fund_invites", sql: "DELETE FROM qfinera_fund_invites WHERE fund_id = $1" },
  { table: "qfinera_fund_join_requests", sql: "DELETE FROM qfinera_fund_join_requests WHERE fund_id = $1" },
  { table: "qfinera_change_requests", sql: "DELETE FROM qfinera_change_requests WHERE fund_id = $1" },
  { table: "qfinera_fund_memberships", sql: "DELETE FROM qfinera_fund_memberships WHERE fund_id = $1" },
  { table: "qfinera_fund_settings", sql: "DELETE FROM qfinera_fund_settings WHERE fund_id = $1" },
  { table: "qfinera_fund_audit_log", sql: "DELETE FROM qfinera_fund_audit_log WHERE fund_id = $1" },
  { table: "qfinera_funds", sql: "DELETE FROM qfinera_funds WHERE id = $1" },
];

export type PurgeResult = { fundId: number; name: string; deleted: Record<string, number> };

/** Pools eligible for purge right now, oldest first. */
export async function purgeablePoolIds(client: PurgeClient, limit = 25): Promise<number[]> {
  const { rows } = await client.query(
    `SELECT id FROM qfinera_funds
      WHERE deleted_at IS NOT NULL AND purge_after IS NOT NULL AND purge_after <= now()
      ORDER BY purge_after, id LIMIT $1`,
    [limit]
  );
  return rows.map((r) => Number(r.id));
}

/**
 * Purges one pool inside the caller's open transaction (the caller BEGINs
 * and COMMITs). Returns null, deleting nothing, when the pool is missing,
 * active, restored, or still within retention.
 */
export async function purgePoolInTransaction(client: PurgeClient, fundId: number): Promise<PurgeResult | null> {
  const { rows } = await client.query(
    `SELECT id, name, deleted_at, deleted_by, deletion_reason, purge_after FROM qfinera_funds
      WHERE id = $1 AND deleted_at IS NOT NULL AND purge_after IS NOT NULL AND purge_after <= now()
      FOR UPDATE`,
    [fundId]
  );
  const pool = rows[0];
  if (!pool) return null;

  // Transaction-local: the triggers' permission ends with this transaction.
  await client.query("SELECT set_config('qfinera.purge_fund_id', $1, true)", [String(fundId)]);

  const deleted: Record<string, number> = {};
  for (const step of PURGE_STEPS) {
    const res = await client.query(step.sql, [fundId]);
    deleted[step.table] = res.rowCount ?? 0;
  }

  await client.query(
    `INSERT INTO qfinance_admin_audit (user_id, action, details) VALUES (NULL, 'qfinera.pool.purged', $1::jsonb)`,
    [
      JSON.stringify({
        fund_id: fundId,
        name: pool.name,
        deleted_at: pool.deleted_at instanceof Date ? pool.deleted_at.toISOString() : pool.deleted_at,
        deleted_by: pool.deleted_by,
        deletion_reason: pool.deletion_reason,
        purge_after: pool.purge_after instanceof Date ? pool.purge_after.toISOString() : pool.purge_after,
        rows_deleted: deleted,
      }),
    ]
  );
  await client.query("SELECT set_config('qfinera.purge_fund_id', '', true)");
  return { fundId, name: String(pool.name), deleted };
}

/**
 * Purges every eligible pool, one transaction each, using a client that can
 * BEGIN/COMMIT (a dedicated pg Client or a checked-out PoolClient).
 */
export async function purgeExpiredPools(client: PurgeClient, limit = 25): Promise<{ purged: PurgeResult[]; failed: Array<{ fundId: number; error: string }> }> {
  const purged: PurgeResult[] = [];
  const failed: Array<{ fundId: number; error: string }> = [];
  for (const fundId of await purgeablePoolIds(client, limit)) {
    try {
      await client.query("BEGIN");
      const result = await purgePoolInTransaction(client, fundId);
      await client.query("COMMIT");
      if (result) purged.push(result);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      failed.push({ fundId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { purged, failed };
}
