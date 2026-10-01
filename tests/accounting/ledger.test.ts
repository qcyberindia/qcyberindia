import { describe, expect, it } from "vitest";
import {
  CURRENT_ACCOUNTING_VERSION,
  sumLedgerDeltas,
  validateNewLedgerEntry,
  type NewLedgerEntry,
} from "../../lib/accounting/ledger";

function entry(over: Partial<NewLedgerEntry>): NewLedgerEntry {
  return {
    fundId: 1,
    memberId: null,
    entryType: "BUY",
    referenceTable: "qfinera_fund_trades",
    referenceId: 1,
    entryDate: "2026-10-01",
    cashDelta: "-1000.00",
    unitsDelta: "0.0000",
    description: null,
    isBackdated: false,
    backdatedReason: null,
    accountingVersion: CURRENT_ACCOUNTING_VERSION,
    createdBy: 1,
    ...over,
  };
}

describe("validateNewLedgerEntry", () => {
  it("accepts well-formed entries of each primary type", () => {
    expect(validateNewLedgerEntry(entry({}))).toEqual([]);
    expect(
      validateNewLedgerEntry(
        entry({ entryType: "CONTRIBUTION", memberId: 7, cashDelta: "5000.00", unitsDelta: "500.0000" })
      )
    ).toEqual([]);
    expect(
      validateNewLedgerEntry(
        entry({ entryType: "WITHDRAWAL", memberId: 7, cashDelta: "-2000.00", unitsDelta: "-200.0000" })
      )
    ).toEqual([]);
    expect(validateNewLedgerEntry(entry({ entryType: "SELL", cashDelta: "1200.00" }))).toEqual([]);
    expect(validateNewLedgerEntry(entry({ entryType: "EXPENSE", cashDelta: "-15.00" }))).toEqual([]);
  });

  it("rejects wrong signs and wrong member scope", () => {
    expect(validateNewLedgerEntry(entry({ entryType: "BUY", cashDelta: "1000.00" }))).not.toEqual([]);
    expect(
      validateNewLedgerEntry(entry({ entryType: "CONTRIBUTION", memberId: null, cashDelta: "5.00", unitsDelta: "1.0000" }))
    ).not.toEqual([]);
    expect(
      validateNewLedgerEntry(entry({ entryType: "WITHDRAWAL", memberId: 7, cashDelta: "-5.00", unitsDelta: "1.0000" }))
    ).not.toEqual([]);
    expect(validateNewLedgerEntry(entry({ entryType: "EXPENSE", unitsDelta: "1.0000" }))).not.toEqual([]);
  });

  it("requires a reason for backdated entries", () => {
    expect(validateNewLedgerEntry(entry({ isBackdated: true }))).not.toEqual([]);
    expect(
      validateNewLedgerEntry(entry({ isBackdated: true, backdatedReason: "Broker statement correction" }))
    ).toEqual([]);
  });

  it("rejects over-precise or non-decimal deltas and bad versions", () => {
    expect(validateNewLedgerEntry(entry({ cashDelta: "-10.001" }))).not.toEqual([]);
    expect(validateNewLedgerEntry(entry({ cashDelta: "1e3" }))).not.toEqual([]);
    expect(validateNewLedgerEntry(entry({ accountingVersion: 0 }))).not.toEqual([]);
  });
});

describe("sumLedgerDeltas", () => {
  it("reconciles cash and units across entries", () => {
    const { cash, units } = sumLedgerDeltas([
      { cashDelta: "10000.00", unitsDelta: "1000.0000" },
      { cashDelta: "-2500.50", unitsDelta: "0.0000" },
      { cashDelta: "-1000.00", unitsDelta: "-100.0000" },
    ]);
    expect(cash.toDecimalString(2)).toBe("6499.50");
    expect(units.toDecimalString(4)).toBe("900.0000");
  });
});
