// Unit allocation / valuation for QFinera Fund. Pure functions on Money.
//
// Approved rules (docs/qfinera-fund/ACCOUNTING_RULES.md):
//   - units = amount / NAV, rounded to 4dp HALF_UP.
//   - NAV is authoritative at 4dp; amounts are rupees at 2dp.
//   - The rounding residual BELONGS TO THE FUND: no extra units are ever
//     issued to absorb it, and it is recorded explicitly for audit.
//
// Residual sign convention (both functions): POSITIVE = the fund keeps
// value, NEGATIVE = the fund absorbs a shortfall. Scale 8 is exact because
// units (4dp) x NAV (4dp) has at most 8 decimal places.
//
// Double-rounding note: Money.divide truncates at 8dp and we then round
// HALF_UP at 4dp. Because the 4dp half-point is itself representable at
// 8dp, truncation can never move a value across the rounding boundary, so
// the result equals rounding the true quotient directly.
import { Money } from "./money";

export const CURRENCY_SCALE = 2 as const;
export const NAV_SCALE = 4 as const;
export const UNIT_SCALE = 4 as const;

function assertMaxScale(value: Money, scale: 2 | 4, label: string): void {
  if (!value.equals(value.round(scale))) {
    throw new Error(`${label} must have at most ${scale} decimal places`);
  }
}

function assertPositive(value: Money, label: string): void {
  if (value.compare(Money.zero()) <= 0) {
    throw new Error(`${label} must be greater than zero`);
  }
}

export type UnitAllocation = {
  /** Units issued, 4dp. */
  units: Money;
  /** amount - (units x nav). Positive: the fund keeps it. Scale 8. */
  residual: Money;
};

/** Contribution: how many units does `amount` buy at `nav`? */
export function allocateUnits(amount: Money, nav: Money): UnitAllocation {
  assertMaxScale(amount, CURRENCY_SCALE, "amount");
  assertMaxScale(nav, NAV_SCALE, "NAV");
  assertPositive(amount, "amount");
  assertPositive(nav, "NAV");

  const units = amount.divide(nav).round(UNIT_SCALE);
  if (units.isZero()) {
    throw new Error("amount is too small to allocate any units at this NAV");
  }

  const residual = amount.subtract(units.multiply(nav));
  return { units, residual };
}

export type UnitValuation = {
  /** Rupee value of the units, 2dp HALF_UP. */
  gross: Money;
  /** (units x nav) - gross. Positive: the fund keeps it. Scale 8. */
  residual: Money;
};

/** Withdrawal by units: what are `units` worth at `nav`? */
export function valueOfUnits(units: Money, nav: Money): UnitValuation {
  assertMaxScale(units, UNIT_SCALE, "units");
  assertMaxScale(nav, NAV_SCALE, "NAV");
  assertPositive(units, "units");
  assertPositive(nav, "NAV");

  const exact = units.multiply(nav);
  const gross = exact.round(CURRENCY_SCALE);
  return { gross, residual: exact.subtract(gross) };
}
