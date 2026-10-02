import { describe, expect, it } from "vitest";
import { Money } from "../../lib/accounting/money";
import {
  checkWithdrawalFeasible,
  computeWithdrawalByAmount,
  computeWithdrawalByUnits,
} from "../../lib/accounting/withdrawals";

const m = (s: string) => Money.fromDecimalString(s);

describe("computeWithdrawalByUnits", () => {
  it("the Fund keeps the charge: net = gross - charges", () => {
    const w = computeWithdrawalByUnits(m("100.0000"), m("10.1234"), m("10.00"));
    expect(w.unitsRedeemed.toDecimalString(4)).toBe("100.0000");
    expect(w.gross.toDecimalString(2)).toBe("1012.34");
    expect(w.charges.toDecimalString(2)).toBe("10.00");
    expect(w.net.toDecimalString(2)).toBe("1002.34");
    expect(w.residual.isZero()).toBe(true);
  });

  it("rounds gross HALF_UP and records the residual (positive = Fund keeps)", () => {
    // 33.3333 x 10.1234 = 337.44632922 -> gross 337.45, residual -0.00367078.
    const w = computeWithdrawalByUnits(m("33.3333"), m("10.1234"), m("0.00"));
    expect(w.gross.toDecimalString(2)).toBe("337.45");
    expect(w.residual.toDecimalString(8)).toBe("-0.00367078");
  });
});

describe("computeWithdrawalByAmount", () => {
  it("pays exactly the approved amount; units = round4(amount / NAV)", () => {
    // 1000 / 10.1234 = 98.78104194 -> 98.7810 units.
    const w = computeWithdrawalByAmount(m("1000.00"), m("10.1234"), m("5.00"));
    expect(w.unitsRedeemed.toDecimalString(4)).toBe("98.7810");
    expect(w.gross.toDecimalString(2)).toBe("1000.00");
    expect(w.net.toDecimalString(2)).toBe("995.00");
    // 98.7810 x 10.1234 = 999.9995754, so residual = -0.0004246 (Fund absorbs it).
    expect(w.residual.toDecimalString(8)).toBe("-0.00042460");
  });

  it("satisfies the identity residual = units x NAV - gross", () => {
    const nav = m("10.3000");
    const w = computeWithdrawalByAmount(m("2500.00"), nav, m("0.00"));
    expect(w.unitsRedeemed.multiply(nav).subtract(w.gross).equals(w.residual)).toBe(true);
  });

  it("an exact division leaves no residual", () => {
    const w = computeWithdrawalByAmount(m("10.00"), m("4.0000"), m("0.00"));
    expect(w.unitsRedeemed.toDecimalString(4)).toBe("2.5000");
    expect(w.residual.isZero()).toBe(true);
  });

  it("rejects bad input", () => {
    expect(() => computeWithdrawalByAmount(m("0.00"), m("10.0000"), m("0.00"))).toThrow();
    expect(() => computeWithdrawalByAmount(m("100.005"), m("10.0000"), m("0.00"))).toThrow(/2 decimal/);
    expect(() => computeWithdrawalByAmount(m("100.00"), Money.zero(), m("0.00"))).toThrow();
    expect(() => computeWithdrawalByAmount(m("0.01"), m("1000000.0000"), m("0.00"))).toThrow(/too small/);
  });

  it("rejects charges that consume the whole amount", () => {
    expect(() => computeWithdrawalByAmount(m("100.00"), m("10.0000"), m("100.00"))).toThrow(/less than/);
    expect(() => computeWithdrawalByAmount(m("100.00"), m("10.0000"), m("-1.00"))).toThrow();
  });
});

describe("checkWithdrawalFeasible", () => {
  const w = computeWithdrawalByAmount(m("1000.00"), m("10.1234"), m("5.00"));

  it("passes when the member has the units and the Fund has the cash", () => {
    const v = checkWithdrawalFeasible({
      memberId: 1,
      memberUnits: m("500.0000"),
      fundCash: m("995.00"),
      computation: w,
    });
    expect(v).toEqual([]);
  });

  it("rejects when rounded units exceed the member's holding", () => {
    const v = checkWithdrawalFeasible({
      memberId: 1,
      memberUnits: m("98.7809"),
      fundCash: m("5000.00"),
      computation: w,
    });
    expect(v.map((x) => x.code)).toEqual(["NEGATIVE_MEMBER_UNITS"]);
  });

  it("never permits negative Fund cash", () => {
    const v = checkWithdrawalFeasible({
      memberId: 1,
      memberUnits: m("500.0000"),
      fundCash: m("994.99"),
      computation: w,
    });
    expect(v.map((x) => x.code)).toEqual(["NEGATIVE_CASH"]);
  });
});
