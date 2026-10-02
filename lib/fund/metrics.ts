// Pure, display-oriented fund metrics derived from authoritative values.
// Relative imports on purpose: this file is unit-tested without the "@/" alias.
import { Money } from "../accounting/money";

const HUNDRED = Money.fromDecimalString("100");

/** A member's share of the fund as a percentage at 2dp; null with no units. */
export function ownershipPercent(units: Money, totalUnits: Money): Money | null {
  if (totalUnits.isZero() || totalUnits.isNegative()) return null;
  return units.multiply(HUNDRED).divide(totalUnits).round(2);
}

/** round2(units x NAV), or null when no official NAV exists yet. */
export function memberValue(units: Money, nav: Money | null): Money | null {
  return nav ? units.multiply(nav).round(2) : null;
}

export type NavChange = { absolute: Money; percent: Money | null };

/** Change between two official NAVs. Percent is 2dp; null if previous is zero. */
export function navChange(nav: Money, previous: Money): NavChange {
  const absolute = nav.subtract(previous);
  const percent = previous.isZero() || previous.isNegative() ? null : absolute.multiply(HUNDRED).divide(previous).round(2);
  return { absolute, percent };
}

/** weight = value / total as a 2dp percentage; null when the total is not positive. */
export function weightPercent(value: Money, total: Money): Money | null {
  if (total.isZero() || total.isNegative()) return null;
  return value.multiply(HUNDRED).divide(total).round(2);
}
