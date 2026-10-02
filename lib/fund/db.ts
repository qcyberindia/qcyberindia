// Thin database access for the QFinera Fund layer: raw SQL + pg, no ORM.
//
//   readDb()        pooled reads (never use for money-moving writes)
//   inTransaction() BEGIN/COMMIT around a callback; ROLLBACK on any throw
//
// Both hand callers the same minimal `Db` interface, so query helpers work
// identically inside and outside a transaction.
import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { getDbPool, withTransaction } from "@/lib/db";
import { notFoundError, unavailableError } from "@/lib/fund/errors";

export type Db = {
  query: <R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) => Promise<QueryResult<R>>;
};

function wrap(client: Pool | PoolClient): Db {
  const c = client as Pool;
  return {
    query: <R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]) =>
      c.query<R>(text, values),
  };
}

export function readDb(): Db {
  const pool = getDbPool();
  if (!pool) throw unavailableError("The database is not configured.");
  return wrap(pool);
}

/** Runs `fn` in one transaction. Throws (and rolls back) on any error. */
export function inTransaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  return withTransaction((client) => fn(wrap(client)));
}

/** First row or null. */
export async function one<R extends QueryResultRow>(db: Db, text: string, values?: unknown[]): Promise<R | null> {
  const { rows } = await db.query<R>(text, values);
  return rows[0] ?? null;
}

/** Takes the per-fund lock so concurrent money operations serialize. */
export async function lockFund(db: Db, fundId: number): Promise<void> {
  const row = await one<{ id: number }>(db, "SELECT id FROM qfinera_funds WHERE id = $1 FOR UPDATE", [fundId]);
  if (!row) throw notFoundError("Fund");
}
