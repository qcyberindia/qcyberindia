// NSE equity master import (EQUITY_L.csv -> qfinera_fund_instruments).
//
// Two stages, kept apart so the parsing rules are unit-testable without a
// database:
//   parseEquityList()   CSV text -> validated rows + rejects + statistics.
//                       Rejects (never guesses) malformed rows, and rejects
//                       EVERY occurrence of a SYMBOL or ISIN that appears
//                       more than once, since the file cannot say which one
//                       is right.
//   applyEquityImport() Idempotent upsert keyed by (symbol, exchange).
//                       * new symbol             -> inserted
//                       * changed master fields  -> updated
//                       * nothing changed        -> skipped (row untouched)
//                       * ISIN conflicts with an existing record (another
//                         symbol already holds it, or this symbol already
//                         has a different ISIN) -> rejected, row untouched
//                       An existing name is preserved (a hand-entered or
//                       richer record is never overwritten); only the
//                       exchange reference columns are refreshed. Nothing is
//                       ever deleted.
//
// EQUITY_L.csv is NSE's list of securities available for trading, so its
// rows are stored with exchange = 'NSE' (the column is NOT NULL and limited
// to NSE/BSE by migration 006). SERIES is stored verbatim; every series is
// imported and labelled, none is assumed to be EQ.
//
// This module has no application imports so scripts/import-nse-equity.ts
// can run it under plain Node.

export type Queryable = {
  query: (text: string, values?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
};

export type EquityRow = {
  line: number;
  symbol: string;
  name: string;
  series: string;
  listingDate: string | null;
  paidUpValue: string | null;
  lotSize: number | null;
  isin: string;
  faceValue: string | null;
};

export type Rejection = { line: number; symbol: string; reason: string };

export type ParsedEquityList = {
  totalRows: number;
  rows: EquityRow[];
  rejected: Rejection[];
  duplicateSymbols: string[];
  duplicateIsins: string[];
  seriesDistribution: Record<string, number>;
};

const HEADERS = {
  symbol: "SYMBOL",
  name: "NAME OF COMPANY",
  series: "SERIES",
  listingDate: "DATE OF LISTING",
  paidUpValue: "PAID UP VALUE",
  lotSize: "MARKET LOT",
  isin: "ISIN NUMBER",
  faceValue: "FACE VALUE",
} as const;

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/** Same rule as normalizeSymbol() in lib/fund/services/market.ts. */
const SYMBOL_RE = /^[A-Z0-9][A-Z0-9&._-]{0,29}$/;
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const DECIMAL_RE = /^\d{1,16}(\.\d{1,4})?$/;

/** Trims and collapses internal runs of whitespace (incl. NBSP) to one space. */
export function normalizeSpace(raw: string): string {
  return raw.replace(/[\s ]+/g, " ").trim();
}

/** ISO 6166 check digit (letters expand to two digits, then Luhn). */
export function isValidIsin(isin: string): boolean {
  if (!ISIN_RE.test(isin)) return false;
  const digits = isin
    .slice(0, 11)
    .split("")
    .map((c) => (c >= "A" ? String(c.charCodeAt(0) - 55) : c))
    .join("");
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === Number(isin[11]);
}

/** "08-FEB-1995" -> "1995-02-08"; null if not a real calendar date. */
export function parseNseDate(raw: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(raw);
  if (!m) return null;
  const month = MONTHS[m[2].toUpperCase()];
  if (!month) return null;
  const iso = `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

/** RFC 4180 CSV (quoted fields, "" escapes, CRLF or LF). */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      out.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    out.push(row);
  }
  return out.filter((r) => r.some((f) => f.trim() !== ""));
}

export function parseEquityList(text: string): ParsedEquityList {
  const [header, ...records] = parseCsv(text);
  if (!header) throw new Error("The CSV is empty.");
  const index = new Map(header.map((h, i) => [normalizeSpace(h).toUpperCase(), i]));
  const col = {} as Record<keyof typeof HEADERS, number>;
  for (const [key, name] of Object.entries(HEADERS) as [keyof typeof HEADERS, string][]) {
    const i = index.get(name);
    if (i === undefined) throw new Error(`The CSV has no "${name}" column.`);
    col[key] = i;
  }

  const rejected: Rejection[] = [];
  const valid: EquityRow[] = [];
  const seriesDistribution: Record<string, number> = {};

  records.forEach((rec, i) => {
    const line = i + 2; // 1-based, after the header
    const get = (k: keyof typeof HEADERS) => normalizeSpace(rec[col[k]] ?? "");
    const symbol = get("symbol").toUpperCase();
    const series = get("series").toUpperCase();
    if (series) seriesDistribution[series] = (seriesDistribution[series] ?? 0) + 1;
    const reject = (reason: string) => rejected.push({ line, symbol, reason });

    if (rec.length !== header.length) return reject(`expected ${header.length} fields, found ${rec.length}`);
    if (!SYMBOL_RE.test(symbol)) return reject("invalid symbol");
    const name = get("name");
    if (!name) return reject("missing company name");
    if (name.length > 120) return reject("company name longer than 120 characters");
    if (!/^[A-Z0-9]{1,4}$/.test(series)) return reject("invalid series");
    const isin = get("isin").toUpperCase();
    if (!isValidIsin(isin)) return reject(`invalid ISIN "${isin}"`);

    const rawDate = get("listingDate");
    const listingDate = rawDate ? parseNseDate(rawDate) : null;
    if (rawDate && !listingDate) return reject(`invalid listing date "${rawDate}"`);
    const rawLot = get("lotSize");
    if (rawLot && !/^[1-9]\d{0,8}$/.test(rawLot)) return reject(`invalid market lot "${rawLot}"`);
    const decimal = (k: "faceValue" | "paidUpValue") => {
      const v = get(k);
      return v === "" ? null : DECIMAL_RE.test(v) ? v : undefined;
    };
    const faceValue = decimal("faceValue");
    if (faceValue === undefined) return reject(`invalid face value "${get("faceValue")}"`);
    const paidUpValue = decimal("paidUpValue");
    if (paidUpValue === undefined) return reject(`invalid paid-up value "${get("paidUpValue")}"`);

    valid.push({ line, symbol, name, series, listingDate, paidUpValue, lotSize: rawLot ? Number(rawLot) : null, isin, faceValue });
  });

  const countBy = (key: "symbol" | "isin") => {
    const n = new Map<string, number>();
    for (const r of valid) n.set(r[key], (n.get(r[key]) ?? 0) + 1);
    return new Set([...n].filter(([, c]) => c > 1).map(([k]) => k));
  };
  const dupSymbols = countBy("symbol");
  const dupIsins = countBy("isin");
  const rows: EquityRow[] = [];
  for (const r of valid) {
    if (dupSymbols.has(r.symbol)) rejected.push({ line: r.line, symbol: r.symbol, reason: "duplicate symbol in file" });
    else if (dupIsins.has(r.isin)) rejected.push({ line: r.line, symbol: r.symbol, reason: `duplicate ISIN ${r.isin} in file` });
    else rows.push(r);
  }
  rejected.sort((a, b) => a.line - b.line);

  return {
    totalRows: records.length,
    rows,
    rejected,
    duplicateSymbols: [...dupSymbols].sort(),
    duplicateIsins: [...dupIsins].sort(),
    seriesDistribution,
  };
}

export type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  rejected: Rejection[];
};

/**
 * Upserts parsed rows. Run inside a transaction (the caller commits or rolls
 * back); takes a table lock so two imports cannot interleave.
 */
export async function applyEquityImport(
  db: Queryable,
  rows: readonly EquityRow[],
  opts: { exchange: "NSE"; source: string }
): Promise<ImportResult> {
  await db.query("LOCK TABLE qfinera_fund_instruments IN SHARE ROW EXCLUSIVE MODE");
  await db.query(
    `CREATE TEMP TABLE qf_equity_import (
       line int, symbol text, name text, series text, listing_date date,
       paid_up_value numeric, lot_size int, isin text, face_value numeric
     ) ON COMMIT DROP`
  );
  await db.query(
    `INSERT INTO qf_equity_import
     SELECT * FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::date[],
                          $6::numeric[], $7::int[], $8::text[], $9::numeric[])`,
    [
      rows.map((r) => r.line),
      rows.map((r) => r.symbol),
      rows.map((r) => r.name),
      rows.map((r) => r.series),
      rows.map((r) => r.listingDate),
      rows.map((r) => r.paidUpValue),
      rows.map((r) => r.lotSize),
      rows.map((r) => r.isin),
      rows.map((r) => r.faceValue),
    ]
  );

  // ISIN conflicts with what is already stored: never resolved by guessing.
  const { rows: conflicts } = await db.query(
    `SELECT DISTINCT ON (t.line) t.line, t.symbol,
            CASE WHEN own.id IS NOT NULL THEN 'existing record has ISIN ' || own.isin || ', file has ' || t.isin
                 ELSE 'ISIN ' || t.isin || ' already belongs to ' || other.symbol END AS reason
       FROM qf_equity_import t
       LEFT JOIN qfinera_fund_instruments own
              ON own.symbol = t.symbol AND own.exchange = $1 AND own.isin IS NOT NULL AND own.isin <> t.isin
       LEFT JOIN qfinera_fund_instruments other
              ON other.isin = t.isin AND other.exchange = $1 AND other.symbol <> t.symbol
      WHERE own.id IS NOT NULL OR other.id IS NOT NULL
      ORDER BY t.line`,
    [opts.exchange]
  );
  await db.query(
    `DELETE FROM qf_equity_import t USING (SELECT unnest($1::int[]) AS line) c WHERE t.line = c.line`,
    [conflicts.map((c) => c.line)]
  );

  const { rows: written } = await db.query(
    `INSERT INTO qfinera_fund_instruments AS i
       (symbol, exchange, name, isin, series, listing_date, lot_size, face_value, paid_up_value, master_source, master_synced_at)
     SELECT symbol, $1, name, isin, series, listing_date, lot_size, face_value, paid_up_value, $2, now()
       FROM qf_equity_import
     ON CONFLICT (symbol, exchange) DO UPDATE SET
       name = COALESCE(NULLIF(btrim(i.name), ''), EXCLUDED.name),
       isin = EXCLUDED.isin,
       series = EXCLUDED.series,
       listing_date = EXCLUDED.listing_date,
       lot_size = EXCLUDED.lot_size,
       face_value = EXCLUDED.face_value,
       paid_up_value = EXCLUDED.paid_up_value,
       master_source = EXCLUDED.master_source,
       master_synced_at = EXCLUDED.master_synced_at
     WHERE (NULLIF(btrim(i.name), ''), i.isin, i.series, i.listing_date, i.lot_size, i.face_value, i.paid_up_value)
           IS DISTINCT FROM
           (COALESCE(NULLIF(btrim(i.name), ''), EXCLUDED.name), EXCLUDED.isin, EXCLUDED.series, EXCLUDED.listing_date,
            EXCLUDED.lot_size, EXCLUDED.face_value, EXCLUDED.paid_up_value)
     RETURNING (xmax = 0) AS inserted`,
    [opts.exchange, opts.source]
  );
  const imported = written.filter((w) => w.inserted === true).length;
  const updated = written.length - imported;
  const rejected = conflicts.map((c) => ({ line: Number(c.line), symbol: String(c.symbol), reason: String(c.reason) }));
  return { imported, updated, skipped: rows.length - rejected.length - written.length, rejected };
}
