// Permanently purges QFinera pools whose 30-day deletion retention has ended.
//
//   node scripts/purge-deleted-pools.ts            # dry run: lists what is due
//   node scripts/purge-deleted-pools.ts --apply    # purge
//
// Connects with DATABASE_URL (DATABASE_SSL=false to disable TLS, as lib/db).
// Requires migration 015. Run it daily (cron / systemd timer / scheduled CI
// job); it is idempotent and safe to run at any frequency. Each pool is
// purged in its own transaction, and the database refuses to delete any pool
// that is not deleted and past retention (see lib/fund/pool-purge.ts).
import { Client } from "pg";
import { purgeExpiredPools } from "../lib/fund/pool-purge.ts";

const apply = process.argv.includes("--apply");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new Client({
  connectionString: url,
  ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
});
await client.connect();
try {
  const { rows } = await client.query(
    `SELECT id, name, deleted_at, purge_after, purge_after <= now() AS due FROM qfinera_funds
      WHERE deleted_at IS NOT NULL ORDER BY purge_after`
  );
  if (rows.length === 0) console.log("No pools are scheduled for deletion.");
  for (const r of rows) {
    console.log(`${r.due ? "DUE    " : "waiting"}  #${r.id} ${r.name}  deleted ${r.deleted_at.toISOString()}  purge after ${r.purge_after.toISOString()}`);
  }
  if (!apply) {
    console.log("Dry run. Re-run with --apply to purge the pools marked DUE.");
  } else {
    const { purged, failed } = await purgeExpiredPools(client);
    for (const p of purged) console.log(`Purged #${p.fundId} ${p.name}:`, JSON.stringify(p.deleted));
    for (const f of failed) console.error(`FAILED #${f.fundId}: ${f.error}`);
    if (failed.length > 0) process.exitCode = 1;
  }
} finally {
  await client.end();
}
