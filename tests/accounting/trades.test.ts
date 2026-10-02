import { describe, expect, it } from "vitest";
import { Money } from "../../lib/accounting/money";
import { checkTradeFeasible, computeTrade, type TradeCharges } from "../../lib/accounting/trades";

const m = (s: string) => Money.fromDecimalString(s);

const charges = (over: Partial<Record<keyof TradeCharges, string>> = {}): TradeCharges => ({
  brokerage: m(over.brokerage ?? "5.00"),
  stt: m(over.stt ?? "5.00"),
  gst: m(over.gst ?? "0.90"),
  stampDuty: m(over.stampDuty ?? "0.75"),
  otherCharges: m(over.otherCharges ?? "0.00"),
});

describe("computeTrade", () => {
  it("BUY: net = gross + charges, cash goes out", () => {
    const c = computeTrade({ side: "BUY", quantity: m("100.0000"), price: m("50.0000"), charges: charges() });
    expect(c.gross.toDecimalString(2)).toBe("5000.00");
    expect(c.totalCharges.toDecimalString(2)).toBe("11.65");
    expect(c.net.toDecimalString(2)).toBe("5011.65");
    expect(c.cashDelta.toDecimalString(2)).toBe("-5011.65");
  });

  it("SELL: net = gross - charges, cash comes in", () => {
    const c = computeTrade({ side: "SELL", quantity: m("100.0000"), price: m("50.0000"), charges: charges() });
    expect(c.net.toDecimalString(2)).toBe("4988.35");
    expect(c.cashDelta.toDecimalString(2)).toBe("4988.35");
  });

  it("rounds the gross HALF_UP to 2dp", () => {
    const c = computeTrade({ side: "BUY", quantity: m("3.0000"), price: m("33.3333"), charges: charges({ brokerage: "0.00", stt: "0.00", gst: "0.00", stampDuty: "0.00" }) });
    expect(c.gross.toDecimalString(2)).toBe("100.00");
  });

  it("rejects non-positive quantity/price, negative or over-precise charges", () => {
    const base = { side: "BUY" as const, quantity: m("1.0000"), price: m("10.0000"), charges: charges() };
    expect(() => computeTrade({ ...base, quantity: m("0.0000") })).toThrow();
    expect(() => computeTrade({ ...base, price: m("-1.0000") })).toThrow();
    expect(() => computeTrade({ ...base, price: m("10.00001") })).toThrow(/4 decimal/);
    expect(() => computeTrade({ ...base, charges: charges({ gst: "-0.01" }) })).toThrow();
    expect(() => computeTrade({ ...base, charges: charges({ gst: "0.001" }) })).toThrow(/2 decimal/);
  });
});

describe("checkTradeFeasible", () => {
  const buy = computeTrade({ side: "BUY", quantity: m("100.0000"), price: m("50.0000"), charges: charges() });
  const sell = computeTrade({ side: "SELL", quantity: m("11.0000"), price: m("50.0000"), charges: charges() });

  it("a BUY that would make cash negative is a hard fail", () => {
    const v = checkTradeFeasible({
      side: "BUY", symbol: "INFY", quantity: m("100.0000"), computation: buy,
      availableCash: m("5000.00"), heldQuantity: Money.zero(),
    });
    expect(v.map((x) => x.code)).toEqual(["NEGATIVE_CASH"]);
  });

  it("a BUY that spends cash down to exactly zero is allowed", () => {
    const v = checkTradeFeasible({
      side: "BUY", symbol: "INFY", quantity: m("100.0000"), computation: buy,
      availableCash: m("5011.65"), heldQuantity: Money.zero(),
    });
    expect(v).toEqual([]);
  });

  it("a SELL of more than is held is an oversell", () => {
    const v = checkTradeFeasible({
      side: "SELL", symbol: "INFY", quantity: m("11.0000"), computation: sell,
      availableCash: m("0.00"), heldQuantity: m("10.0000"),
    });
    expect(v.map((x) => x.code)).toEqual(["NEGATIVE_HOLDING_QUANTITY"]);
  });

  it("a covered SELL is fine", () => {
    const v = checkTradeFeasible({
      side: "SELL", symbol: "INFY", quantity: m("11.0000"), computation: sell,
      availableCash: m("0.00"), heldQuantity: m("11.0000"),
    });
    expect(v).toEqual([]);
  });
});
