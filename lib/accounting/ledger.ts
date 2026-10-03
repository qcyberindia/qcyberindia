// Ledger types and pure validation for qfinera_fund_ledger_entries (see
// db/migrations/006 + 007). The ledger is APPEND-ONLY: corrections are new
// REVERSAL / ADJUSTMENT rows, never an UPDATE or DELETE (enforced in the
// database by a trigger in migration 007, and again here by convention).
//
// The functions that actually write entries (recordContribution,
// recordTrade, ...) belong to later phases; this module defines the shape,
// the sign rules, and the arithmetic they share.
import { Money } from "./money";

/** Bump when the posting rules change in a way that alters how old entries
 * must be interpreted. Stored on every entry as accounting_version. */
export const CURRENT_ACCOUNTING_VERSION = 1;

export type LedgerEntryType =
  | "CONTRIBUTION"
  | "WITHDRAWAL"
  | "BUY"
  | "SELL"
  | "EXPENSE"
  | "ADJUSTMENT"
  | "REVERSAL"
  /** Cash posting of a mark-to-market product trade (migration 012); any sign. */
  | "TRADE_MTM";

/** Mirrors qfinera_fund_ledger_entries. `cashDelta`/`unitsDelta` are plain
 * decimal strings (how pg round-trips NUMERIC); route them through
 * Money.fromDecimalString before arithmetic. */
export type LedgerEntry = {
  id: number;
  fundId: number;
  /** Null for fund-level entries (trades, expenses). */
  memberId: number | null;
  entryType: LedgerEntryType;
  referenceTable: string;
  referenceId: number;
  entryDate: string; // ISO date (YYYY-MM-DD)
  cashDelta: string;
  unitsDelta: string;
  description: string | null;
  isBackdated: boolean;
  backdatedReason: string | null;
  accountingVersion: number;
  createdBy: number;
  createdAt: string; // ISO timestamp
};

export type NewLedgerEntry = Omit<LedgerEntry, "id" | "createdAt">;

/**
 * Mirrors the CHECK constraints in migration 007 so a bad entry is rejected
 * before a round trip to the database. Returns a list of problems; an empty
 * list means the entry is well-formed. The database remains the final
 * authority.
 */
export function validateNewLedgerEntry(entry: NewLedgerEntry): string[] {
  const errors: string[] = [];

  let cash: Money;
  let units: Money;
  try {
    cash = Money.fromDecimalString(entry.cashDelta);
    units = Money.fromDecimalString(entry.unitsDelta);
  } catch {
    return ["cashDelta and unitsDelta must be plain decimal strings"];
  }

  if (!cash.equals(cash.round(2))) errors.push("cashDelta must have at most 2 decimal places");
  if (!units.equals(units.round(4))) errors.push("unitsDelta must have at most 4 decimal places");

  const zero = Money.zero();
  const member = entry.memberId;

  switch (entry.entryType) {
    case "CONTRIBUTION":
      if (member === null) errors.push("CONTRIBUTION requires a member");
      if (units.compare(zero) <= 0) errors.push("CONTRIBUTION unitsDelta must be positive");
      if (cash.compare(zero) <= 0) errors.push("CONTRIBUTION cashDelta must be positive");
      break;
    case "WITHDRAWAL":
      if (member === null) errors.push("WITHDRAWAL requires a member");
      if (units.compare(zero) >= 0) errors.push("WITHDRAWAL unitsDelta must be negative");
      if (cash.compare(zero) >= 0) errors.push("WITHDRAWAL cashDelta must be negative");
      break;
    case "BUY":
      if (member !== null) errors.push("BUY is a fund-level entry (no member)");
      if (!units.isZero()) errors.push("BUY must not change units");
      if (cash.compare(zero) >= 0) errors.push("BUY cashDelta must be negative");
      break;
    case "SELL":
      if (member !== null) errors.push("SELL is a fund-level entry (no member)");
      if (!units.isZero()) errors.push("SELL must not change units");
      break;
    case "EXPENSE":
      if (member !== null) errors.push("EXPENSE is a fund-level entry (no member)");
      if (!units.isZero()) errors.push("EXPENSE must not change units");
      if (cash.compare(zero) >= 0) errors.push("EXPENSE cashDelta must be negative");
      break;
    case "TRADE_MTM":
      if (member !== null) errors.push("TRADE_MTM is a fund-level entry (no member)");
      if (!units.isZero()) errors.push("TRADE_MTM must not change units");
      break;
    case "ADJUSTMENT":
    case "REVERSAL":
      break;
  }

  if (entry.isBackdated && !(entry.backdatedReason ?? "").trim()) {
    errors.push("a backdated entry requires a reason");
  }
  if (!Number.isInteger(entry.accountingVersion) || entry.accountingVersion < 1) {
    errors.push("accountingVersion must be a positive integer");
  }

  return errors;
}

/** Sums cash and unit deltas across entries. Used to reconcile the ledger
 * against cash, member units, and NAV snapshots. */
export function sumLedgerDeltas(
  entries: ReadonlyArray<Pick<LedgerEntry, "cashDelta" | "unitsDelta">>
): { cash: Money; units: Money } {
  let cash = Money.zero();
  let units = Money.zero();
  for (const e of entries) {
    cash = cash.add(Money.fromDecimalString(e.cashDelta));
    units = units.add(Money.fromDecimalString(e.unitsDelta));
  }
  return { cash, units };
}
