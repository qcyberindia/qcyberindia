import { describe, expect, it } from "vitest";
import { Money } from "../../lib/accounting/money";

const m = (s: string) => Money.fromDecimalString(s);

describe("Money.fromDecimalString", () => {
  it("parses plain decimals and round-trips them", () => {
    expect(m("10.1234").toDecimalString(4)).toBe("10.1234");
    expect(m("-5").toDecimalString(2)).toBe("-5.00");
    expect(m("0.00000001").toDecimalString(8)).toBe("0.00000001");
  });

  it.each(["", " ", "1e5", "+1", "1,000", "1.2.3", "abc", ".5", "5.", "--1"])(
    "rejects ambiguous input %j",
    (input) => {
      expect(() => m(input)).toThrow();
    }
  );

  it("rejects more than 8 decimal places", () => {
    expect(() => m("0.123456789")).toThrow();
  });

  it("treats -0 as zero", () => {
    expect(m("-0").isNegative()).toBe(false);
    expect(m("-0.00").equals(Money.zero())).toBe(true);
  });
});

describe("Money arithmetic", () => {
  it("adds exactly where floating point would not (0.1 + 0.2)", () => {
    expect(m("0.1").add(m("0.2")).equals(m("0.3"))).toBe(true);
  });

  it("subtracts and multiplies exactly", () => {
    expect(m("10.50").subtract(m("0.75")).toDecimalString(2)).toBe("9.75");
    expect(m("10.5").multiply(m("3")).toDecimalString(2)).toBe("31.50");
  });

  it("divides at internal precision and rounds only at the boundary", () => {
    expect(m("10").divide(m("3")).toDecimalString(4)).toBe("3.3333");
    expect(m("2").divide(m("3")).toDecimalString(4)).toBe("0.6667");
  });

  it("throws on division by zero", () => {
    expect(() => m("1").divide(Money.zero())).toThrow(/division by zero/);
  });

  it("compares and tests sign", () => {
    expect(m("1").compare(m("2"))).toBe(-1);
    expect(m("2").compare(m("2"))).toBe(0);
    expect(m("3").compare(m("2"))).toBe(1);
    expect(m("-0.01").isNegative()).toBe(true);
    expect(Money.zero().isZero()).toBe(true);
  });
});

describe("Money rounding (HALF_UP, away from zero)", () => {
  it("rounds exact halves up", () => {
    expect(m("0.125").toDecimalString(2)).toBe("0.13");
    expect(m("0.124999").toDecimalString(2)).toBe("0.12");
  });

  it("rounds negative halves away from zero", () => {
    expect(m("-0.125").toDecimalString(2)).toBe("-0.13");
    expect(m("-0.001").toDecimalString(2)).toBe("0.00"); // no negative zero string
  });

  it("round() is idempotent and returns an exactly representable value", () => {
    const once = m("1.23456789").round(4);
    expect(once.round(4).equals(once)).toBe(true);
    expect(once.toDecimalString(4)).toBe("1.2346");
    expect(once.equals(m("1.2346"))).toBe(true);
  });

  it("pads to the requested scale", () => {
    expect(m("0.05").toDecimalString(2)).toBe("0.05");
    expect(m("5").toDecimalString(4)).toBe("5.0000");
  });
});
