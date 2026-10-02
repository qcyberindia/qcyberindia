// Trade arithmetic and feasibility checks for QFinera Fund. Pure functions.
//
// A trade affects accounting on its trade date (cash and holdings); the
// official NAV is still struck at EOD. Charges are entered per component
// (automatic or manually overridden; overrides are audited elsewhere).
//
// Conventions (see docs/qfinera-fund/ACCOUNTING_RULES.md section 9):
//   gross     = round2(quantity x price)
//   BUY  net  = gross + total charges   -> cash_delta = -net
//   SELL net  = gross - total charges   -> cash_delta = +net
//   net_value is stored as a positive magnitude.
import { Money } from "./money";
import {
  checkCashNonNegative,
  checkHoldingQuantity,
  type InvariantViolation,
} from "./invariants";

export type TradeSide = "BUY" | "SELL";

export type TradeCharges = {
  brokerage: Money;
  stt: Money;
  gst: Money;
  stampDuty: Money;
  otherCharges: Money;
};

export type TradeComputation = {
  gross: Money;
  totalCharges: Money;
  net: Money;
  cashDelta: Money;
};

function assertScaleAndSign(
  value: Money,
  scale: 2 | 4,
  label: string,
  rule: "positive" | "non-negative"
): void {
  if (!value.equals(value.round(scale))) {
    throw new Error(`${label} must have at most ${scale} decimal places`);
  }
  if (rule === "positive" ? value.compare(Money.zero()) <= 0 : value.isNegative()) {
    throw new Error(`${label} must be ${rule === "positive" ? "greater than zero" : "zero or more"}`);
  }
}

/** round2(quantity x price), after validating both (4 dp, > 0). */
export function tradeGross(quantity: Money, price: Money): Money {
  assertScaleAndSign(quantity, 4, "quantity", "positive");
  assertScaleAndSign(price, 4, "price", "positive");
  return quantity.multiply(price).round(2);
}

export function sumCharges(charges: TradeCharges): Money {
  const parts: Array<[Money, string]> = [
    [charges.brokerage, "brokerage"],
    [charges.stt, "STT"],
    [charges.gst, "GST"],
    [charges.stampDuty, "stamp duty"],
    [charges.otherCharges, "other charges"],
  ];
  let total = Money.zero();
  for (const [value, label] of parts) {
    assertScaleAndSign(value, 2, label, "non-negative");
    total = total.add(value);
  }
  return total;
}

export function computeTrade(input: {
  side: TradeSide;
  quantity: Money;
  price: Money;
  charges: TradeCharges;
}): TradeComputation {
  const gross = tradeGross(input.quantity, input.price);
  const totalCharges = sumCharges(input.charges);
  if (input.side === "BUY") {
    const net = gross.add(totalCharges);
    return { gross, totalCharges, net, cashDelta: Money.zero().subtract(net) };
  }
  const net = gross.subtract(totalCharges);
  return { gross, totalCharges, net, cashDelta: net };
}

/**
 * Would this trade leave the fund in a valid state? Negative cash and
 * overselling are hard fails; callers pass the result to
 * assertNoViolations() inside the transaction.
 */
export function checkTradeFeasible(input: {
  side: TradeSide;
  symbol: string;
  quantity: Money;
  computation: TradeComputation;
  availableCash: Money;
  heldQuantity: Money;
}): InvariantViolation[] {
  const cashAfter = input.availableCash.add(input.computation.cashDelta);
  const violations = checkCashNonNegative(cashAfter);
  if (input.side === "SELL") {
    violations.push(...checkHoldingQuantity(input.symbol, input.heldQuantity.subtract(input.quantity)));
  }
  return violations;
}
