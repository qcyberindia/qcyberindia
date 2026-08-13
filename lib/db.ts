import { Pool } from "pg";

// Lazily-created singleton pool, mirroring lib/email.ts's pattern: if
// DATABASE_URL isn't set, every function here becomes a safe no-op instead
// of crashing the request. This lets local dev and early deploys work
// before a database is provisioned.
let pool: Pool | null = null;
let triedInit = false;

function getPool(): Pool | null {
  if (pool) return pool;
  if (triedInit) return null; // already tried and failed/skipped
  triedInit = true;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  pool = new Pool({
    connectionString,
    // Most managed Postgres providers (Neon, RDS, Supabase) require SSL.
    // Allow opting out for a local/self-hosted DB via DATABASE_SSL=false.
    ssl:
      process.env.DATABASE_SSL === "false"
        ? undefined
        : { rejectUnauthorized: false },
    max: 5,
  });

  return pool;
}

export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// Creates the qbids_registrations table if it doesn't exist yet. Safe to
// call on every request — CREATE TABLE IF NOT EXISTS is idempotent. Avoids
// requiring a separate manual migration step before first deploy.
export async function ensureQbidsTable(): Promise<void> {
  const p = getPool();
  if (!p) return;

  await p.query(`
    CREATE TABLE IF NOT EXISTS qbids_registrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      portals TEXT[] NOT NULL DEFAULT '{}',
      challenge TEXT,
      status TEXT NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'reviewed', 'qualified', 'invited', 'active', 'declined')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export type QbidsRegistrationRow = {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  portals: string[];
  challenge: string | null;
  status: string;
  created_at: string;
};

export async function getQbidsRegistrations(): Promise<QbidsRegistrationRow[]> {
  const p = getPool();
  if (!p) return [];

  const { rows } = await p.query(
    `SELECT id, name, company, email, phone, portals, challenge, status, created_at
     FROM qbids_registrations
     ORDER BY created_at DESC`
  );
  return rows;
}

const VALID_STATUSES = ["new", "reviewed", "qualified", "invited", "active", "declined"];

export async function updateQbidsRegistrationStatus(
  id: number,
  status: string
): Promise<{ ok: boolean; error?: string }> {
  if (!VALID_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status" };
  }

  const p = getPool();
  if (!p) return { ok: false, error: "Database is not configured." };

  try {
    await p.query(`UPDATE qbids_registrations SET status = $1 WHERE id = $2`, [status, id]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown database error" };
  }
}

export type QbidsRegistrationInput = {
  name: string;
  company: string;
  email: string;
  phone: string;
  portals: string[];
  challenge?: string;
};

export type InsertResult =
  | { ok: true; duplicate: false }
  | { ok: true; duplicate: true }
  | { ok: false; error: string };

// Inserts a new registration. Returns duplicate: true instead of an error
// if the email already exists — a repeat signup shouldn't look like a
// failure to the person submitting it.
export async function insertQbidsRegistration(
  input: QbidsRegistrationInput
): Promise<InsertResult> {
  const p = getPool();
  if (!p) {
    return { ok: false, error: "Database is not configured (DATABASE_URL missing)." };
  }

  try {
    await ensureQbidsTable();

    await p.query(
      `INSERT INTO qbids_registrations (name, company, email, phone, portals, challenge)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.name,
        input.company,
        input.email.toLowerCase(),
        input.phone,
        input.portals,
        input.challenge || null,
      ]
    );

    return { ok: true, duplicate: false };
  } catch (err: unknown) {
    // Postgres unique_violation error code
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      return { ok: true, duplicate: true };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown database error",
    };
  }
}
