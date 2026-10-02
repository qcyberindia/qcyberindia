// Integration-test harness: a throwaway PostgreSQL database per test file.
//
// Opt-in. Set FUND_TEST_DATABASE_URL to an ADMIN connection on a LOCAL
// server, e.g. postgres://user@127.0.0.1:5432/postgres. The harness
// creates a uniquely named database, applies db/migrations in order, points
// lib/db at it (DATABASE_URL is read lazily on first use), and drops it
// afterwards. It refuses any non-local host, so it can never touch a real
// database. Without the variable, the integration suites are skipped.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { Client } from "pg";
import type { Db } from "@/lib/fund/db";
import { createSession, SESSION_COOKIE } from "@/lib/qfinera-auth/sessions";

export const ADMIN_URL = process.env.FUND_TEST_DATABASE_URL ?? "";
export const integrationEnabled = ADMIN_URL !== "";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function assertLocal(url: string): URL {
  const u = new URL(url);
  if (!LOCAL_HOSTS.has(u.hostname)) {
    throw new Error(`FUND_TEST_DATABASE_URL must point at a local server (got host "${u.hostname}").`);
  }
  return u;
}

export type TestDb = { url: string; name: string; query: (sql: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>; close: () => Promise<void> };

export async function createTestDatabase(): Promise<TestDb> {
  const admin = assertLocal(ADMIN_URL);
  const name = `fund_it_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
  const adminClient = new Client({ connectionString: admin.toString() });
  await adminClient.connect();
  await adminClient.query(`CREATE DATABASE ${name}`);
  await adminClient.end();

  const dbUrl = new URL(admin.toString());
  dbUrl.pathname = `/${name}`;
  const client = new Client({ connectionString: dbUrl.toString() });
  await client.connect();
  const dir = join(process.cwd(), "db/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await client.query(readFileSync(join(dir, file), "utf8"));
  }

  // lib/db creates its pool lazily from these on first use.
  process.env.DATABASE_URL = dbUrl.toString();
  process.env.DATABASE_SSL = "false";
  // Never send real email from tests: without a key, emails are not sent and
  // (outside production) their links are logged, which tests capture.
  delete process.env.RESEND_API_KEY;

  return {
    url: dbUrl.toString(),
    name,
    query: (sql, values) => client.query(sql, values),
    close: async () => {
      await client.end();
      const { getDbPool } = await import("@/lib/db");
      await getDbPool()?.end();
      const drop = new Client({ connectionString: admin.toString() });
      await drop.connect();
      await drop.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await drop.end();
    },
  };
}

export type TestUser = { id: number; email: string; displayName: string; cookie: string };

/** A verified, active account with a real server-side session. */
export async function createUser(db: TestDb, handle: string): Promise<TestUser> {
  const email = `${handle}@example.test`;
  const { rows } = await db.query(
    "INSERT INTO qfinance_users (email, display_name, email_verified_at) VALUES ($1, $2, now()) RETURNING id",
    [email, handle]
  );
  const id = rows[0].id as number;
  const { token } = await createSession(db as unknown as Db, id, null);
  return { id, email, displayName: handle, cookie: `${SESSION_COOKIE}=${token}` };
}

/** A request as the browser would send it (same-origin JSON). */
export function request(user: TestUser | null, path: string, init: { method?: string; body?: unknown } = {}): NextRequest {
  const headers: Record<string, string> = { host: "localhost:3000" };
  if (user) headers.cookie = user.cookie;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`http://localhost:3000${path}`, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

export const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

// Test assertions walk arbitrary response JSON; a loose type keeps them readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseJson = any;

export async function json(res: Response): Promise<{ status: number; body: LooseJson }> {
  return { status: res.status, body: await res.json() };
}
