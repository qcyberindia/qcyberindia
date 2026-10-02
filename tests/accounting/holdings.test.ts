import { describe, expect, it } from "vitest";
import { Money } from "../../lib/accounting/money";
import {
  applyBuy,
  applySell,
  averageCost,
  emptyPosition,
  marketValue,
  unrealizedPnl,
} from "../../lib/accounting/holdings";

const m = (s: string) => Money.fromDecimalString(s);
const trade = (qty: string, price: string, charges = "0.00") => ({
  quantity: m(qty),
  price: m(price),
  charges: m(charges),
});

describe("average-cost holdings", () => {
  it("first buy capitalizes charges into cost basis", () => {
    const p = applyBuy(emptyPosition(), trade("100.0000", "50.0000", "10.00"));
    expect(p.quantity.toDecimalString(4)).toBe("100.0000");
    expect(p.costBasis.toDecimalString(2)).toBe("5010.00");
    expect(averageCost(p)?.toDecimalString(4)).toBe("50.1000");
    expect(p.realizedPnl.isZero()).toBe(true);
  });

  it("walks buy, buy, partial sell, full sell, rebuy", () => {
    let p = applyBuy(emptyPosition(), trade("100.0000", "50.0000", "10.00"));

    // second buy: 100 @ 60, no charges -> cost 6000
    p = applyBuy(p, trade("100.0000", "60.0000"));
    expect(p.quantity.toDecimalString(4)).toBe("200.0000");
    expect(p.costBasis.toDecimalString(2)).toBe("11010.00");
    expect(averageCost(p)?.toDecimalString(4)).toBe("55.0500");

    // partial sell: 50 @ 70, charges 20 -> proceeds 3480; cost removed 2752.50
    p = applySell(p, trade("50.0000", "70.0000", "20.00"));
    expect(p.quantity.toDecimalString(4)).toBe("150.0000");
    expect(p.costBasis.toDecimalString(2)).toBe("8257.50");
    expect(p.realizedPnl.toDecimalString(2)).toBe("727.50");

    // unrealized at 55: value 8250.00 vs cost 8257.50
    expect(marketValue(p, m("55.0000")).toDecimalString(2)).toBe("8250.00");
    expect(unrealizedPnl(p, m("55.0000")).toDecimalString(2)).toBe("-7.50");

    // full sell: 150 @ 40 -> proceeds 6000; removes ALL remaining cost
    p = applySell(p, trade("150.0000", "40.0000"));
    expect(p.quantity.isZero()).toBe(true);
    expect(p.costBasis.isZero()).toBe(true);
    expect(p.realizedPnl.toDecimalString(2)).toBe("-1530.00");
    expect(averageCost(p)).toBeNull();

    // rebuy after zero keeps cumulative realized P&L
    p = applyBuy(p, trade("10.0000", "100.0000"));
    expect(p.costBasis.toDecimalString(2)).toBe("1000.00");
    expect(p.realizedPnl.toDecimalString(2)).toBe("-1530.00");
  });

  it("rounds the cost removed on a partial sell HALF_UP to 2dp", () => {
    // 3 @ 33.3333 = 99.9999 -> 100.00 cost
    let p = applyBuy(emptyPosition(), trade("3.0000", "33.3333"));
    expect(p.costBasis.toDecimalString(2)).toBe("100.00");
    // sell 1 @ 40: cost removed 100/3 = 33.33; realized 40.00 - 33.33 = 6.67
    p = applySell(p, trade("1.0000", "40.0000"));
    expect(p.costBasis.toDecimalString(2)).toBe("66.67");
    expect(p.realizedPnl.toDecimalString(2)).toBe("6.67");
  });

  it("refuses to oversell", () => {
    const p = applyBuy(emptyPosition(), trade("10.0000", "100.0000"));
    expect(() => applySell(p, trade("11.0000", "100.0000"))).toThrow(/only 10.0000 held/);
  });

  it("rejects invalid trade inputs", () => {
    expect(() => applyBuy(emptyPosition(), trade("0.0000", "10.0000"))).toThrow();
    expect(() => applyBuy(emptyPosition(), trade("1.0000", "-1.0000"))).toThrow();
    expect(() => applyBuy(emptyPosition(), trade("1.0000", "10.0000", "-1.00"))).toThrow();
  });

  it("does not mutate the previous position", () => {
    const before = applyBuy(emptyPosition(), trade("10.0000", "100.0000"));
    applySell(before, trade("5.0000", "100.0000"));
    expect(before.quantity.toDecimalString(4)).toBe("10.0000");
  });
});
