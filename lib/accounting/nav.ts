// Official NAV calculation for QFinera Fund. Pure.
//
//   Fund Value = Cash + Value of open positions + approved adjustments
//
// A line without `value` is a long holding valued at round2(quantity x
// price). A line WITH `value` carries its signed contribution from the
// position engine (lib/accounting/positions.ts navValue): a short option
// is a negative liability, an intraday/futures position its unrealized
// price difference.
//   NAV        = round4(Fund Value / Outstanding Units)
//
// Each holding is valued at round2(quantity x price) and the values are
// summed. With zero outstanding units there is nothing to divide by; NAV
// is the fund's initial NAV (10.0000 by default), per the approved
// zero-capital start. Negative cash is a hard fail, so a NAV can never be
// struck over an invalid cash balance.
import { Money } from "./money";
import { assertNoViolations, checkCashNonNegative } from "./invariants";

export const INITIAL_NAV = "10.0000";

export type HoldingValuation = {
  symbol: string;
  quantity: Money;
  price: Money;
  /** Signed contribution to Fund Value, 2dp; overrides quantity x price. */
  value?: Money;
};

export type NavInput = {
  cash: Money;
  holdings: readonly HoldingValuation[];
  /** Approved accounting adjustments (signed). */
  adjustments: Money;
  outstandingUnits: Money;
  /** The fund's configured initial NAV (4dp). */
  initialNav: Money;
};

export type NavResult = {
  cash: Money;
  holdingsValue: Money;
  fundValue: Money;
  outstandingUnits: Money;
  nav: Money;
};

export function calculateNav(input: NavInput): NavResult {
  assertNoViolations(checkCashNonNegative(input.cash));
  if (input.outstandingUnits.isNegative()) {
    throw new Error("outstanding units cannot be negative");
  }

  let holdingsValue = Money.zero();
  for (const h of input.holdings) {
    if (h.quantity.isNegative()) throw new Error(`${h.symbol}: quantity cannot be negative`);
    if (h.price.compare(Money.zero()) <= 0) throw new Error(`${h.symbol}: price must be greater than zero`);
    holdingsValue = holdingsValue.add(h.value ? h.value.round(2) : h.quantity.multiply(h.price).round(2));
  }

  const cash = input.cash.round(2);
  const fundValue = cash.add(holdingsValue).add(input.adjustments).round(2);

  if (input.outstandingUnits.isZero()) {
    return {
      cash,
      holdingsValue,
      fundValue,
      outstandingUnits: input.outstandingUnits,
      nav: input.initialNav.round(4),
    };
  }

  const nav = fundValue.divide(input.outstandingUnits).round(4);
  if (nav.compare(Money.zero()) <= 0) {
    throw new Error("NAV must be greater than zero; refusing to strike a non-positive NAV");
  }
  return { cash, holdingsValue, fundValue, outstandingUnits: input.outstandingUnits, nav };
}
