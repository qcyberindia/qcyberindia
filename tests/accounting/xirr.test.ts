import { describe, expect, it } from "vitest";
import { Money } from "../../lib/accounting/money";
import { xirr, type DatedCashFlow } from "../../lib/accounting/xirr";

const m = (s: string) => Money.fromDecimalString(s);
const flow = (date: string, amount: string): DatedCashFlow => ({ date, amount: m(amount) });

// Independent check: net present value of the flows at `rate`, using the same
// day-count convention (actual days / 365 from the earliest flow).
function npv(rate: number, items: Array<{ days: number; amount: number }>): number {
  return items.reduce((sum, i) => sum + i.amount / Math.pow(1 + rate, i.days / 365), 0);
}

describe("xirr", () => {
  it("one contribution and one terminal value, exactly one year apart", () => {
    const r = xirr([flow("2025-01-01", "-10000.00"), flow("2026-01-01", "11000.00")]);
    expect(r).not.toBeNull();
    expect(r as number).toBeCloseTo(0.1, 6);
  });

  it("zero return gives a rate of zero", () => {
    expect(xirr([flow("2025-01-01", "-100.00"), flow("2026-01-01", "100.00")]) as number).toBeCloseTo(0, 6);
  });

  it("a loss gives a negative rate", () => {
    expect(xirr([flow("2025-01-01", "-100.00"), flow("2026-01-01", "50.00")]) as number).toBeCloseTo(-0.5, 6);
  });

  it("multiple contributions at irregular dates solve to a rate where NPV is zero", () => {
    const r = xirr([
      flow("2025-01-01", "-10000.00"),
      flow("2025-07-01", "-5000.00"),
      flow("2026-01-01", "16500.00"),
    ]);
    expect(r).not.toBeNull();
    expect(r as number).toBeGreaterThan(0.1);
    expect(r as number).toBeLessThan(0.2);
    const check = npv(r as number, [
      { days: 0, amount: -10000 },
      { days: 181, amount: -5000 },
      { days: 365, amount: 16500 },
    ]);
    expect(Math.abs(check)).toBeLessThan(1e-4);
  });

  it("a partial withdrawal (positive flow) before the terminal value", () => {
    const r = xirr([
      flow("2025-01-01", "-10000.00"),
      flow("2025-07-01", "2000.00"),
      flow("2026-01-01", "9500.00"),
    ]);
    expect(r).not.toBeNull();
    const check = npv(r as number, [
      { days: 0, amount: -10000 },
      { days: 181, amount: 2000 },
      { days: 365, amount: 9500 },
    ]);
    expect(Math.abs(check)).toBeLessThan(1e-4);
  });

  it("is N/A (null) when it cannot be solved", () => {
    expect(xirr([])).toBeNull();
    expect(xirr([flow("2025-01-01", "-100.00")])).toBeNull(); // no positive flow
    expect(xirr([flow("2025-01-01", "100.00")])).toBeNull(); // no negative flow
    expect(xirr([flow("2025-01-01", "-100.00"), flow("2026-01-01", "0.00")])).toBeNull(); // total loss, nothing back
    expect(xirr([flow("2025-01-01", "-100.00"), flow("2025-01-01", "110.00")])).toBeNull(); // same day
  });

  it("is N/A for an invalid date instead of guessing", () => {
    expect(xirr([flow("2025-02-30", "-100.00"), flow("2026-01-01", "110.00")])).toBeNull();
    expect(xirr([flow("not-a-date", "-100.00"), flow("2026-01-01", "110.00")])).toBeNull();
  });
});
