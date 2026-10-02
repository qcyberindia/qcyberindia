import { describe, expect, it } from "vitest";
import { Money } from "../../lib/accounting/money";
import { ownershipPercent, percentOf, replayPositions, type ReplayTrade } from "../../lib/accounting/portfolio";
import { estimateTax, TAX_DISCLAIMER } from "../../lib/accounting/tax";

const m = (s: string) => Money.fromDecimalString(s);

function trade(
  id: number,
  tradeDate: string,
  side: "BUY" | "SELL",
  quantity: string,
  price: string,
  charges = "0.00",
  instrumentId = 1
): ReplayTrade {
  return { id, instrumentId, tradeDate, side, quantity: m(quantity), price: m(price), charges: m(charges) };
}

describe("replayPositions", () => {
  it("replays in (date, id) order regardless of input order", () => {
    const trades = [
      trade(3, "2026-01-04", "SELL", "5.0000", "120.0000", "2.00"),
      trade(2, "2026-01-03", "BUY", "10.0000", "110.0000", "5.00"),
      trade(1, "2026-01-02", "BUY", "10.0000", "100.0000", "5.00"),
    ];
    const pos = replayPositions(trades).get(1)!;
    // cost = (1000 + 5) + (1100 + 5) = 2110; sell 5 of 20 removes 527.50.
    expect(pos.quantity.toDecimalString(4)).toBe("15.0000");
    expect(pos.costBasis.toDecimalString(2)).toBe("1582.50");
    // proceeds 600 - 2 = 598; realized = 598 - 527.50 = 70.50.
    expect(pos.realizedPnl.toDecimalString(2)).toBe("70.50");
  });

  it("keeps instruments separate", () => {
    const positions = replayPositions([
      trade(1, "2026-01-02", "BUY", "10.0000", "100.0000", "0.00", 1),
      trade(2, "2026-01-02", "BUY", "4.0000", "50.0000", "0.00", 2),
    ]);
    expect(positions.get(1)!.quantity.toDecimalString(4)).toBe("10.0000");
    expect(positions.get(2)!.quantity.toDecimalString(4)).toBe("4.0000");
  });

  it("throws on an oversell", () => {
    expect(() =>
      replayPositions([
        trade(1, "2026-01-02", "BUY", "1.0000", "100.0000"),
        trade(2, "2026-01-03", "SELL", "2.0000", "100.0000"),
      ])
    ).toThrow(/cannot sell/);
  });
});

describe("percentages", () => {
  it("percentOf", () => {
    expect(percentOf(m("25.00"), m("200.00"))).toBe("12.50");
    expect(percentOf(m("1.00"), Money.zero())).toBeNull();
  });

  it("ownershipPercent", () => {
    expect(ownershipPercent(m("250.0000"), m("1000.0000"))).toBe("25.0000");
    expect(ownershipPercent(m("1.0000"), Money.zero())).toBeNull();
  });
});

describe("estimateTax (informational)", () => {
  const rates = { stcgRate: "20", ltcgRate: "12.5" };

  it("labels every estimate", () => {
    const est = estimateTax([], rates);
    expect(est.disclaimer).toBe(TAX_DISCLAIMER);
    expect(TAX_DISCLAIMER).toBe("ESTIMATE — NOT TAX ADVICE");
    expect(est.totalEstimatedTax.isZero()).toBe(true);
  });

  it("long-term gain (held more than 365 days)", () => {
    const est = estimateTax(
      [trade(1, "2025-01-01", "BUY", "10.0000", "100.0000"), trade(2, "2026-02-01", "SELL", "10.0000", "150.0000")],
      rates
    );
    expect(est.ltcgGain.toDecimalString(2)).toBe("500.00");
    expect(est.stcgGain.toDecimalString(2)).toBe("0.00");
    expect(est.ltcgTax.toDecimalString(2)).toBe("62.50");
  });

  it("short-term gain", () => {
    const est = estimateTax(
      [trade(1, "2026-01-01", "BUY", "10.0000", "100.0000"), trade(2, "2026-03-01", "SELL", "10.0000", "120.0000")],
      rates
    );
    expect(est.stcgGain.toDecimalString(2)).toBe("200.00");
    expect(est.stcgTax.toDecimalString(2)).toBe("40.00");
  });

  it("consumes lots FIFO and splits a sell across holding periods", () => {
    const est = estimateTax(
      [
        trade(1, "2025-01-01", "BUY", "5.0000", "100.0000"),
        trade(2, "2026-01-01", "BUY", "5.0000", "200.0000"),
        trade(3, "2026-06-01", "SELL", "7.0000", "300.0000"),
      ],
      rates
    );
    // 5 units from lot 1: proceeds 1500, cost 500 -> long-term gain 1000.
    // 2 units from lot 2: proceeds 600, cost 400 -> short-term gain 200.
    expect(est.ltcgGain.toDecimalString(2)).toBe("1000.00");
    expect(est.stcgGain.toDecimalString(2)).toBe("200.00");
    expect(est.ltcgTax.toDecimalString(2)).toBe("125.00");
    expect(est.stcgTax.toDecimalString(2)).toBe("40.00");
    expect(est.totalEstimatedTax.toDecimalString(2)).toBe("165.00");
  });

  it("a loss produces no tax", () => {
    const est = estimateTax(
      [trade(1, "2026-01-01", "BUY", "10.0000", "100.0000"), trade(2, "2026-02-01", "SELL", "10.0000", "90.0000")],
      rates
    );
    expect(est.stcgGain.toDecimalString(2)).toBe("-100.00");
    expect(est.stcgTax.isZero()).toBe(true);
  });

  it("only counts sells inside the window", () => {
    const trades = [
      trade(1, "2026-01-01", "BUY", "10.0000", "100.0000"),
      trade(2, "2026-02-01", "SELL", "5.0000", "120.0000"),
      trade(3, "2026-09-01", "SELL", "5.0000", "130.0000"),
    ];
    const est = estimateTax(trades, rates, { from: "2026-08-01", to: "2026-12-31" });
    // Only the September sell counts: proceeds 650, cost 500.
    expect(est.stcgGain.toDecimalString(2)).toBe("150.00");
  });

  it("rejects out-of-range rates", () => {
    expect(() => estimateTax([], { stcgRate: "101", ltcgRate: "10" })).toThrow();
    expect(() => estimateTax([], { stcgRate: "-1", ltcgRate: "10" })).toThrow();
  });
});
