// Accounting invariants for QFinera Fund. Pure checks over Money values.
// Each check returns a list of violations (empty = OK); callers inside a
// transaction pass the combined list to assertNoViolations(), which throws
// so the transaction rolls back. An invariant failure must always fail
// safe: never "fix up" a value to make a check pass.
import { Money } from "./money";

export type InvariantCode =
  | "UNITS_MISMATCH"
  | "NEGATIVE_MEMBER_UNITS"
  | "NEGATIVE_CASH"
  | "FUND_VALUE_MISMATCH"
  | "NAV_MISMATCH"
  | "NEGATIVE_HOLDING_QUANTITY";

export type InvariantViolation = { code: InvariantCode; message: string };

export class InvariantError extends Error {
  constructor(readonly violations: readonly InvariantViolation[]) {
    super(`Accounting invariant violated: ${violations.map((v) => v.code).join(", ")}`);
    this.name = "InvariantError";
  }
}

/** Fund units == sum of member units (exact; both are 4dp). */
export function checkUnitsReconcile(
  fundUnits: Money,
  memberUnits: readonly Money[]
): InvariantViolation[] {
  const sum = memberUnits.reduce((acc, u) => acc.add(u), Money.zero());
  return sum.equals(fundUnits)
    ? []
    : [
        {
          code: "UNITS_MISMATCH",
          message: `fund units ${fundUnits.toDecimalString(4)} != member total ${sum.toDecimalString(4)}`,
        },
      ];
}

export function checkNoNegativeMemberUnits(
  members: ReadonlyArray<{ memberId: number; units: Money }>
): InvariantViolation[] {
  return members
    .filter((m) => m.units.isNegative())
    .map((m) => ({
      code: "NEGATIVE_MEMBER_UNITS" as const,
      message: `member ${m.memberId} has negative units ${m.units.toDecimalString(4)}`,
    }));
}

/** Negative cash is a hard fail; there is no tolerated temporary overdraft. */
export function checkCashNonNegative(cash: Money): InvariantViolation[] {
  return cash.isNegative()
    ? [{ code: "NEGATIVE_CASH", message: `cash would be ${cash.toDecimalString(2)}` }]
    : [];
}

/** fundValue == cash + holdingsValue + adjustments, compared at 2dp. */
export function checkFundValue(
  cash: Money,
  holdingsValue: Money,
  adjustments: Money,
  fundValue: Money
): InvariantViolation[] {
  const expected = cash.add(holdingsValue).add(adjustments).round(2);
  return expected.equals(fundValue.round(2))
    ? []
    : [
        {
          code: "FUND_VALUE_MISMATCH",
          message: `fund value ${fundValue.toDecimalString(2)} != expected ${expected.toDecimalString(2)}`,
        },
      ];
}

/** NAV == round4(fundValue / outstandingUnits). With zero outstanding units
 * there is no NAV to derive, so the check does not apply. */
export function checkNav(
  fundValue: Money,
  outstandingUnits: Money,
  nav: Money
): InvariantViolation[] {
  if (outstandingUnits.isZero()) return [];
  const expected = fundValue.divide(outstandingUnits).round(4);
  return expected.equals(nav.round(4))
    ? []
    : [
        {
          code: "NAV_MISMATCH",
          message: `NAV ${nav.toDecimalString(4)} != expected ${expected.toDecimalString(4)}`,
        },
      ];
}

export function checkHoldingQuantity(symbol: string, quantity: Money): InvariantViolation[] {
  return quantity.isNegative()
    ? [
        {
          code: "NEGATIVE_HOLDING_QUANTITY",
          message: `${symbol} quantity would be ${quantity.toDecimalString(4)} (oversell)`,
        },
      ]
    : [];
}

export function assertNoViolations(violations: readonly InvariantViolation[]): void {
  if (violations.length > 0) throw new InvariantError(violations);
}
