import { describe, expect, it } from "vitest";
import { Money } from "../../lib/accounting/money";
import { allocateUnits, valueOfUnits } from "../../lib/accounting/units";

const m = (s: string) => Money.fromDecimalString(s);

describe("allocateUnits (contribution)", () => {
  it("first contribution at the initial NAV of 10.0000", () => {
    const { units, residual } = allocateUnits(m("10000.00"), m("10.0000"));
    expect(units.toDecimalString(4)).toBe("1000.0000");
    expect(residual.isZero()).toBe(true);
  });

  it("late joiner at a changed NAV, residual recorded and owned by the fund", () => {
    // 10000 / 10.3 = 970.8737864..., rounds HALF_UP to 970.8738.
    const { units, residual } = allocateUnits(m("10000.00"), m("10.3000"));
    expect(units.toDecimalString(4)).toBe("970.8738");
    // 970.8738 x 10.3 = 10000.00014, so the fund absorbed 0.00014.
    expect(residual.toDecimalString(8)).toBe("-0.00014000");
  });

  it("never leaves a residual larger than half a unit's value", () => {
    const amounts = ["1.00", "999.99", "5000.00", "123456.78"];
    const navs = ["10.0000", "10.1234", "9.8765", "101.5000", "0.5000"];
    for (const a of amounts) {
      for (const n of navs) {
        const amount = m(a);
        const nav = m(n);
        const { units, residual } = allocateUnits(amount, nav);
        expect(units.equals(units.round(4))).toBe(true);
        const abs = residual.isNegative() ? Money.zero().subtract(residual) : residual;
        expect(abs.compare(nav.multiply(m("0.00005")))).not.toBe(1);
        // The identity the ledger relies on: amount = units x NAV + residual.
        expect(units.multiply(nav).add(residual).equals(amount)).toBe(true);
      }
    }
  });

  it("rejects non-positive amounts, non-positive NAV, and over-precise inputs", () => {
    expect(() => allocateUnits(m("0.00"), m("10.0000"))).toThrow();
    expect(() => allocateUnits(m("-5.00"), m("10.0000"))).toThrow();
    expect(() => allocateUnits(m("100.00"), Money.zero())).toThrow();
    expect(() => allocateUnits(m("100.001"), m("10.0000"))).toThrow(/2 decimal/);
    expect(() => allocateUnits(m("100.00"), m("10.12345"))).toThrow(/4 decimal/);
  });

  it("rejects an amount too small to buy any units", () => {
    expect(() => allocateUnits(m("0.01"), m("1000000.0000"))).toThrow(/too small/);
  });
});

describe("valueOfUnits (withdrawal by units)", () => {
  it("exact value has no residual", () => {
    const { gross, residual } = valueOfUnits(m("100.0000"), m("10.1234"));
    expect(gross.toDecimalString(2)).toBe("1012.34");
    expect(residual.isZero()).toBe(true);
  });

  it("rounds the rupee value HALF_UP and records the residual", () => {
    // 33.3333 x 10.1234 = 337.44632922 -> 337.45 gross.
    const { gross, residual } = valueOfUnits(m("33.3333"), m("10.1234"));
    expect(gross.toDecimalString(2)).toBe("337.45");
    expect(residual.toDecimalString(8)).toBe("-0.00367078");
  });

  it("rejects non-positive and over-precise inputs", () => {
    expect(() => valueOfUnits(Money.zero(), m("10.0000"))).toThrow();
    expect(() => valueOfUnits(m("1.00005"), m("10.0000"))).toThrow(/4 decimal/);
    expect(() => valueOfUnits(m("1.0000"), m("10.00005"))).toThrow(/4 decimal/);
  });
});
