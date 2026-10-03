// Imports NSE's equity master (EQUITY_L.csv) into qfinera_fund_instruments.
//
//   node scripts/import-nse-equity.ts --file ~/Downloads/EQUITY_L.csv            # dry run
//   node scripts/import-nse-equity.ts --file ~/Downloads/EQUITY_L.csv --apply    # write
//
// Connects with DATABASE_URL (DATABASE_SSL=false to disable TLS, as lib/db).
// Requires migration 011. Without --apply the whole import runs inside a
// transaction that is rolled back, so the statistics are exact but nothing
// is written. Idempotent: re-running with the same file changes nothing.
// Rules: lib/market-data/nse-equity-import.ts.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { Client } from "pg";
import { applyEquityImport, parseEquityList } from "../lib/market-data/nse-equity-import.ts";

function arg(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? null);
}

async function main() {
  const file = arg("--file");
  const apply = process.argv.includes("--apply");
  const showRejects = process.argv.includes("--show-rejects");
  if (!file) throw new Error("Usage: node scripts/import-nse-equity.ts --file <EQUITY_L.csv> [--apply] [--show-rejects]");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const parsed = parseEquityList(readFileSync(file, "utf8"));
  const client = new Client({
    connectionString: url,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  let result;
  try {
    await client.query("BEGIN");
    result = await applyEquityImport(client, parsed.rows, { exchange: "NSE", source: `NSE:${basename(file)}` });
    await client.query(apply ? "COMMIT" : "ROLLBACK");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }

  const rejected = [...parsed.rejected, ...result.rejected].sort((a, b) => a.line - b.line);
  const host = new URL(url).hostname;
  console.log(`${apply ? "APPLIED" : "DRY RUN (rolled back)"} -> ${host}`);
  console.log(
    JSON.stringify(
      {
        totalRows: parsed.totalRows,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        rejected: rejected.length,
        duplicateSymbols: parsed.duplicateSymbols,
        duplicateIsins: parsed.duplicateIsins,
        seriesDistribution: parsed.seriesDistribution,
      },
      null,
      2
    )
  );
  if (rejected.length > 0) {
    const shown = showRejects ? rejected : rejected.slice(0, 20);
    for (const r of shown) console.log(`  line ${r.line} ${r.symbol || "(no symbol)"}: ${r.reason}`);
    if (shown.length < rejected.length) console.log(`  ... ${rejected.length - shown.length} more (--show-rejects)`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
