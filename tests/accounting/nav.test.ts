import { describe, expect, it } from "vitest";
import { Money } from "../../lib/accounting/money";
import { InvariantError } from "../../lib/accounting/invariants";
import { calculateNav, type NavInput } from "../../lib/accounting/nav";

const m = (s: string) => Money.fromDecimalString(s);

function input(over: Partial<NavInput> = {}): NavInput {
  return {
    cash: m("0.00"),
    holdings: [],
    adjustments: m("0.00"),
    outstandingUnits: m("0.0000"),
    initialNav: m("10.0000"),
    ...over,
  };
}

describe("calculateNav", () => {
  it("a fund with zero units strikes the initial NAV", () => {
    const r = calculateNav(input());
    expect(r.nav.toDecimalString(4)).toBe("10.0000");
    expect(r.fundValue.isZero()).toBe(true);
  });

  it("cash only: NAV = cash / units", () => {
    const r = calculateNav(input({ cash: m("5000.00"), outstandingUnits: m("500.0000") }));
    expect(r.nav.toDecimalString(4)).toBe("10.0000");
  });

  it("cash + holdings, rounded to 4dp", () => {
    const r = calculateNav(
      input({
        cash: m("4000.00"),
        holdings: [{ symbol: "INFY", quantity: m("100.0000"), price: m("60.1234") }],
        outstandingUnits: m("1000.0000"),
      })
    );
    expect(r.holdingsValue.toDecimalString(2)).toBe("6012.34");
    expect(r.fundValue.toDecimalString(2)).toBe("10012.34");
    // 10012.34 / 1000 = 10.01234 -> 10.0123
    expect(r.nav.toDecimalString(4)).toBe("10.0123");
  });

  it("values each holding at round2(quantity x price)", () => {
    const r = calculateNav(
      input({
        holdings: [{ symbol: "TCS", quantity: m("3.0000"), price: m("33.3333") }],
        cash: m("0.00"),
        outstandingUnits: m("10.0000"),
      })
    );
    expect(r.holdingsValue.toDecimalString(2)).toBe("100.00");
    expect(r.nav.toDecimalString(4)).toBe("10.0000");
  });

  it("includes approved adjustments in fund value", () => {
    const r = calculateNav(
      input({ cash: m("1000.00"), adjustments: m("-50.00"), outstandingUnits: m("100.0000") })
    );
    expect(r.fundValue.toDecimalString(2)).toBe("950.00");
    expect(r.nav.toDecimalString(4)).toBe("9.5000");
  });

  it("negative cash is a hard fail", () => {
    expect(() => calculateNav(input({ cash: m("-0.01"), outstandingUnits: m("1.0000") }))).toThrow(
      InvariantError
    );
  });

  it("refuses to strike a non-positive NAV", () => {
    expect(() => calculateNav(input({ outstandingUnits: m("100.0000") }))).toThrow(/non-positive NAV/);
  });

  it("rejects invalid holdings", () => {
    expect(() =>
      calculateNav(input({ holdings: [{ symbol: "X", quantity: m("-1.0000"), price: m("10.0000") }] }))
    ).toThrow();
    expect(() =>
      calculateNav(input({ holdings: [{ symbol: "X", quantity: m("1.0000"), price: m("0.0000") }] }))
    ).toThrow();
  });
});
