// Database-backed rate limiting for authentication endpoints (works across
// server instances). Each attempt is a row in qfinance_auth_attempts keyed by
// a bucket such as "login-fail:email:x@y.z" or "register:ip:1.2.3.4".
import { one, type Db } from "@/lib/fund/db";
import { FundError } from "@/lib/fund/errors";

export type Limit = { bucket: string; max: number; windowMinutes: number };

export const tooManyAttempts = () =>
  new FundError("RATE_LIMITED", "Too many attempts. Please wait a few minutes and try again.", 429);

export async function countAttempts(db: Db, bucket: string, windowMinutes: number): Promise<number> {
  const row = await one<{ n: number }>(
    db,
    `SELECT COUNT(*)::int AS n FROM qfinance_auth_attempts
      WHERE bucket = $1 AND created_at > now() - make_interval(mins => $2)`,
    [bucket, windowMinutes]
  );
  return row?.n ?? 0;
}

/** Throws 429 if any bucket is already at its limit; otherwise records one attempt in each. */
export async function consume(db: Db, limits: readonly Limit[]): Promise<void> {
  for (const l of limits) {
    if ((await countAttempts(db, l.bucket, l.windowMinutes)) >= l.max) throw tooManyAttempts();
  }
  for (const l of limits) await record(db, l.bucket);
}

/** Throws 429 if the bucket is at its limit, without recording anything. */
export async function assertUnderLimit(db: Db, limit: Limit): Promise<void> {
  if ((await countAttempts(db, limit.bucket, limit.windowMinutes)) >= limit.max) throw tooManyAttempts();
}

export async function record(db: Db, bucket: string): Promise<void> {
  await db.query("INSERT INTO qfinance_auth_attempts (bucket) VALUES ($1)", [bucket]);
  // Opportunistic cleanup keeps the table small without a scheduled job.
  if (Math.random() < 0.02) {
    await db.query("DELETE FROM qfinance_auth_attempts WHERE created_at < now() - interval '2 days'");
  }
}

export async function clear(db: Db, bucket: string): Promise<void> {
  await db.query("DELETE FROM qfinance_auth_attempts WHERE bucket = $1", [bucket]);
}
