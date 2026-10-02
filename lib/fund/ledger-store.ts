// The ONLY write path into qfinera_fund_ledger_entries.
//
// Every financial event posts through postLedgerEntry(), which validates the
// entry with the Phase 1 rules (validateNewLedgerEntry) before touching the
// database. The ledger is append-only (trigger in migration 007): there is
// deliberately no update or delete helper here.
import type { Money } from "@/lib/accounting/money";
import {
  CURRENT_ACCOUNTING_VERSION,
  validateNewLedgerEntry,
  type LedgerEntryType,
  type NewLedgerEntry,
} from "@/lib/accounting/ledger";
import { one, type Db } from "@/lib/fund/db";

export type LedgerPost = {
  fundId: number;
  memberId: number | null;
  entryType: LedgerEntryType;
  referenceTable:
    | "qfinera_fund_contributions"
    | "qfinera_fund_withdrawals"
    | "qfinera_fund_trades"
    | "qfinera_fund_expenses";
  referenceId: number;
  /** ISO date the entry takes accounting effect. */
  entryDate: string;
  cashDelta: Money;
  unitsDelta: Money;
  description?: string | null;
  isBackdated?: boolean;
  backdatedReason?: string | null;
  createdBy: number;
};

export async function postLedgerEntry(db: Db, post: LedgerPost): Promise<number> {
  const entry: NewLedgerEntry = {
    fundId: post.fundId,
    memberId: post.memberId,
    entryType: post.entryType,
    referenceTable: post.referenceTable,
    referenceId: post.referenceId,
    entryDate: post.entryDate,
    cashDelta: post.cashDelta.toDecimalString(2),
    unitsDelta: post.unitsDelta.toDecimalString(4),
    description: post.description ?? null,
    isBackdated: post.isBackdated ?? false,
    backdatedReason: post.backdatedReason ?? null,
    accountingVersion: CURRENT_ACCOUNTING_VERSION,
    createdBy: post.createdBy,
  };

  const problems = validateNewLedgerEntry(entry);
  if (problems.length > 0) {
    // A programming error, not a user error: never reaches the database.
    throw new Error(`Ledger entry rejected: ${problems.join("; ")}`);
  }

  const row = await one<{ id: number }>(
    db,
    `INSERT INTO qfinera_fund_ledger_entries
       (fund_id, member_id, entry_type, reference_table, reference_id, entry_date,
        cash_delta, units_delta, description, is_backdated, backdated_reason,
        accounting_version, created_by)
     VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id`,
    [
      entry.fundId,
      entry.memberId,
      entry.entryType,
      entry.referenceTable,
      entry.referenceId,
      entry.entryDate,
      entry.cashDelta,
      entry.unitsDelta,
      entry.description,
      entry.isBackdated,
      entry.backdatedReason,
      entry.accountingVersion,
      entry.createdBy,
    ]
  );
  if (!row) throw new Error("Ledger insert returned no row");
  return row.id;
}
