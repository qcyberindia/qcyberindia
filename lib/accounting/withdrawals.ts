// Withdrawal redemption arithmetic for QFinera Fund. Pure functions on Money.
//
// Approved rules (docs/qfinera-fund/ACCOUNTING_RULES.md, section 2):
//   - The Fund KEEPS the withdrawal charge:
//       net cash to member = gross - charges
//       Fund cash decreases by the NET amount; the charge stays in the Fund.
//   - By units:  gross = round2(units x NAV);  residual = units x NAV - gross
//   - By amount: units = round4(approved amount / NAV)  (HALF_UP);
//                gross = approved amount;
//                residual = units x NAV - gross
//   - Residual sign: positive = the Fund keeps value (same as valueOfUnits).
//   - Rounded redemption units above the member's holding are rejected.
//   - Fund cash can never go negative.
import { Money } from "./money";
import {
  checkCashNonNegative,
  checkNoNegativeMemberUnits,
  type InvariantViolation,
} from "./invariants";
import { CURRENCY_SCALE, NAV_SCALE, UNIT_SCALE, valueOfUnits } from "./units";

export type WithdrawalComputation = {
  /** Units redeemed, 4dp. */
  unitsRedeemed: Money;
  /** Rupees before charges, 2dp. */
  gross: Money;
  charges: Money;
  /** gross - charges, 2dp. What leaves the Fund's cash and reaches the member. */
  net: Money;
  /** units x NAV - gross. Positive: the Fund keeps it. Scale 8. */
  residual: Money;
};

function assertScale(value: Money, scale: 2 | 4, label: string): void {
  if (!value.equals(value.round(scale))) {
    throw new Error(`${label} must have at most ${scale} decimal places`);
  }
}

function finish(unitsRedeemed: Money, gross: Money, charges: Money, residual: Money): WithdrawalComputation {
  assertScale(charges, CURRENCY_SCALE, "charges");
  if (charges.isNegative()) throw new Error("charges must be zero or more");
  const net = gross.subtract(charges);
  if (net.compare(Money.zero()) <= 0) {
    throw new Error("charges must be less than the withdrawal amount");
  }
  return { unitsRedeemed, gross, charges, net, residual };
}

/** Withdrawal by units: redeem exactly `units` at `nav`. */
export function computeWithdrawalByUnits(units: Money, nav: Money, charges: Money): WithdrawalComputation {
  const { gross, residual } = valueOfUnits(units, nav);
  return finish(units, gross, charges, residual);
}

/** Withdrawal by amount: pay exactly `approvedAmount`; derive the units. */
export function computeWithdrawalByAmount(
  approvedAmount: Money,
  nav: Money,
  charges: Money
): WithdrawalComputation {
  assertScale(approvedAmount, CURRENCY_SCALE, "approved amount");
  assertScale(nav, NAV_SCALE, "NAV");
  if (approvedAmount.compare(Money.zero()) <= 0) throw new Error("approved amount must be greater than zero");
  if (nav.compare(Money.zero()) <= 0) throw new Error("NAV must be greater than zero");

  const units = approvedAmount.divide(nav).round(UNIT_SCALE);
  if (units.isZero()) throw new Error("amount is too small to redeem any units at this NAV");

  const residual = units.multiply(nav).subtract(approvedAmount);
  return finish(units, approvedAmount, charges, residual);
}

/**
 * Would redeeming leave the Fund and the member in a valid state?
 * Callers pass the result to assertNoViolations() inside the transaction.
 */
export function checkWithdrawalFeasible(input: {
  memberId: number;
  memberUnits: Money;
  fundCash: Money;
  computation: WithdrawalComputation;
}): InvariantViolation[] {
  return [
    ...checkNoNegativeMemberUnits([
      { memberId: input.memberId, units: input.memberUnits.subtract(input.computation.unitsRedeemed) },
    ]),
    ...checkCashNonNegative(input.fundCash.subtract(input.computation.net)),
  ];
}
