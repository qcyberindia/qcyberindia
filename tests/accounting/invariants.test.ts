import { describe, expect, it } from "vitest";
import { Money } from "../../lib/accounting/money";
import {
  InvariantError,
  assertNoViolations,
  checkCashNonNegative,
  checkFundValue,
  checkHoldingQuantity,
  checkNav,
  checkNoNegativeMemberUnits,
  checkUnitsReconcile,
} from "../../lib/accounting/invariants";

const m = (s: string) => Money.fromDecimalString(s);

describe("invariants", () => {
  it("fund units must equal the sum of member units", () => {
    expect(checkUnitsReconcile(m("1500.0000"), [m("1000.0000"), m("500.0000")])).toEqual([]);
    const v = checkUnitsReconcile(m("1500.0000"), [m("1000.0000"), m("499.9999")]);
    expect(v.map((x) => x.code)).toEqual(["UNITS_MISMATCH"]);
  });

  it("no member may hold negative units", () => {
    const v = checkNoNegativeMemberUnits([
      { memberId: 1, units: m("10.0000") },
      { memberId: 2, units: m("-0.0001") },
    ]);
    expect(v).toHaveLength(1);
    expect(v[0].code).toBe("NEGATIVE_MEMBER_UNITS");
  });

  it("negative cash is a hard fail", () => {
    expect(checkCashNonNegative(m("0.00"))).toEqual([]);
    expect(checkCashNonNegative(m("-0.01"))[0].code).toBe("NEGATIVE_CASH");
  });

  it("fund value = cash + holdings + adjustments", () => {
    expect(checkFundValue(m("1000.00"), m("2500.50"), m("0.00"), m("3500.50"))).toEqual([]);
    expect(checkFundValue(m("1000.00"), m("2500.50"), m("0.00"), m("3500.51"))[0].code).toBe(
      "FUND_VALUE_MISMATCH"
    );
  });

  it("NAV = round4(fund value / outstanding units)", () => {
    expect(checkNav(m("10123.40"), m("1000.0000"), m("10.1234"))).toEqual([]);
    expect(checkNav(m("10123.40"), m("1000.0000"), m("10.1235"))[0].code).toBe("NAV_MISMATCH");
  });

  it("NAV check does not apply with zero outstanding units", () => {
    expect(checkNav(Money.zero(), Money.zero(), m("10.0000"))).toEqual([]);
  });

  it("flags an oversell as a negative holding quantity", () => {
    expect(checkHoldingQuantity("INFY", m("0.0000"))).toEqual([]);
    expect(checkHoldingQuantity("INFY", m("-5.0000"))[0].code).toBe("NEGATIVE_HOLDING_QUANTITY");
  });

  it("assertNoViolations throws InvariantError carrying every violation", () => {
    const violations = [...checkCashNonNegative(m("-1.00")), ...checkHoldingQuantity("TCS", m("-1"))];
    expect(() => assertNoViolations([])).not.toThrow();
    try {
      assertNoViolations(violations);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(InvariantError);
      expect((err as InvariantError).violations).toHaveLength(2);
    }
  });
});
