import { describe, expect, it } from "vitest";
import { applyBuy, applySell, emptyPosition } from "../../lib/accounting/holdings";
import { Money } from "../../lib/accounting/money";
import {
  PositionError,
  applyExecution,
  averageEntryPrice,
  emptyBookPosition,
  exposure,
  invalidCombination,
  navValue,
  replayBook,
  sideFor,
  unrealized,
  type BookPosition,
  type BookTrade,
  type Execution,
} from "../../lib/accounting/positions";

const m = (s: string) => Money.fromDecimalString(s);
const s2 = (x: Money) => x.toDecimalString(2);

function run(steps: Execution[]): { position: BookPosition; cash: Money[]; realized: Money[] } {
  let position = emptyBookPosition();
  const cash: Money[] = [];
  const realized: Money[] = [];
  for (const step of steps) {
    const e = applyExecution(position, step);
    position = e.position;
    cash.push(e.cashDelta);
    realized.push(e.realized);
  }
  return { position, cash, realized };
}

const ex = (product: Execution["product"], action: Execution["action"], quantity: string, price: string, charges = "0"): Execution => ({
  product,
  action,
  quantity: m(quantity),
  price: m(price),
  charges: m(charges),
});

describe("side and combination rules", () => {
  it("derives the execution side from the position action", () => {
    expect(sideFor("OPEN_LONG")).toBe("BUY");
    expect(sideFor("CLOSE_SHORT")).toBe("BUY");
    expect(sideFor("OPEN_SHORT")).toBe("SELL");
    expect(sideFor("CLOSE_LONG")).toBe("SELL");
  });

  it("rejects a side that contradicts the action, and short delivery", () => {
    expect(invalidCombination("EQUITY_INTRADAY", "OPEN_SHORT", "BUY")).toMatch(/SELL/);
    expect(invalidCombination("EQUITY_DELIVERY", "OPEN_SHORT")).toMatch(/long-only/);
    expect(invalidCombination("EQUITY_DELIVERY", "CLOSE_SHORT")).toMatch(/long-only/);
    expect(invalidCombination("EQUITY_INTRADAY", "OPEN_SHORT", "SELL")).toBeNull();
    expect(invalidCombination("OPTIONS", "OPEN_SHORT")).toBeNull();
  });
});

describe("equity delivery matches the existing average-cost holdings exactly", () => {
  it("same quantity, cost basis and realized P&L as applyBuy/applySell, with charges", () => {
    let legacy = emptyPosition();
    legacy = applyBuy(legacy, { quantity: m("10"), price: m("1500"), charges: m("20.00") });
    legacy = applyBuy(legacy, { quantity: m("5"), price: m("1510.25"), charges: m("7.33") });
    legacy = applySell(legacy, { quantity: m("7"), price: m("1523.40"), charges: m("11.11") });

    const r = run([
      ex("EQUITY_DELIVERY", "OPEN_LONG", "10", "1500", "20.00"),
      ex("EQUITY_DELIVERY", "OPEN_LONG", "5", "1510.25", "7.33"),
      ex("EQUITY_DELIVERY", "CLOSE_LONG", "7", "1523.40", "11.11"),
    ]);
    expect(r.position.quantity.equals(legacy.quantity)).toBe(true);
    expect(s2(r.position.entryGross.add(r.position.openCharges))).toBe(s2(legacy.costBasis));
    expect(s2(r.position.realizedPnl)).toBe(s2(legacy.realizedPnl));
    // Full traded value moves cash.
    expect(r.cash.map(s2)).toEqual(["-15020.00", "-7558.58", "10652.69"]);
  });

  it("cannot sell more than is held", () => {
    const { position } = run([ex("EQUITY_DELIVERY", "OPEN_LONG", "5", "100")]);
    expect(() => applyExecution(position, ex("EQUITY_DELIVERY", "CLOSE_LONG", "6", "100"))).toThrow(/cannot sell 6\.0000: only 5\.0000 held/);
    expect(() => applyExecution(emptyBookPosition(), ex("EQUITY_DELIVERY", "CLOSE_LONG", "1", "100"))).toThrow(PositionError);
  });
});

describe("equity intraday short (mark-to-market)", () => {
  it("opens a short with no holding, partially then fully closes, booking the spec's P&L", () => {
    const r = run([
      ex("EQUITY_INTRADAY", "OPEN_SHORT", "100", "1520"),
      ex("EQUITY_INTRADAY", "CLOSE_SHORT", "40", "1500"),
      ex("EQUITY_INTRADAY", "CLOSE_SHORT", "60", "1490"),
    ]);
    // (1520-1500) x 40 = 800; (1520-1490) x 60 = 1800
    expect(r.realized.map(s2)).toEqual(["0.00", "800.00", "1800.00"]);
    expect(s2(r.position.realizedPnl)).toBe("2600.00");
    expect(r.position.direction).toBeNull();
    expect(r.position.quantity.isZero()).toBe(true);
    // No notional moves: opening costs nothing (no charges), closes settle the difference.
    expect(r.cash.map(s2)).toEqual(["0.00", "800.00", "1800.00"]);
  });

  it("after the partial close the position is SHORT 60 at the original entry", () => {
    const r = run([ex("EQUITY_INTRADAY", "OPEN_SHORT", "100", "1520"), ex("EQUITY_INTRADAY", "CLOSE_SHORT", "40", "1500")]);
    expect(r.position.direction).toBe("SHORT");
    expect(r.position.quantity.toDecimalString(4)).toBe("60.0000");
    expect(averageEntryPrice(r.position)?.toDecimalString(4)).toBe("1520.0000");
  });

  it("charges: capitalized on open, deducted on close; cash and realized agree in total", () => {
    const r = run([ex("EQUITY_INTRADAY", "OPEN_SHORT", "100", "1520", "30.00"), ex("EQUITY_INTRADAY", "CLOSE_SHORT", "100", "1490", "25.00")]);
    expect(s2(r.realized[1])).toBe("2945.00"); // 3000 - 30 - 25
    expect(r.cash.map(s2)).toEqual(["-30.00", "2975.00"]);
    expect(s2(r.cash[0].add(r.cash[1]))).toBe(s2(r.position.realizedPnl));
    expect(s2(r.position.chargesPaid)).toBe("55.00");
  });

  it("a losing short", () => {
    const r = run([ex("EQUITY_INTRADAY", "OPEN_SHORT", "10", "100"), ex("EQUITY_INTRADAY", "CLOSE_SHORT", "10", "112.5")]);
    expect(s2(r.position.realizedPnl)).toBe("-125.00");
    expect(s2(r.cash[1])).toBe("-125.00");
  });

  it("unrealized and NAV value of an open short", () => {
    const { position } = run([ex("EQUITY_INTRADAY", "OPEN_SHORT", "100", "1520")]);
    expect(s2(unrealized(position, m("1490")))).toBe("3000.00");
    expect(s2(navValue(position, "EQUITY_INTRADAY", m("1490")))).toBe("3000.00");
    expect(s2(navValue(position, "EQUITY_INTRADAY", m("1530")))).toBe("-1000.00");
  });

  it("intraday long: open, close; cash is the price difference", () => {
    const r = run([ex("EQUITY_INTRADAY", "OPEN_LONG", "50", "200", "5.00"), ex("EQUITY_INTRADAY", "CLOSE_LONG", "50", "210", "5.00")]);
    expect(r.cash.map(s2)).toEqual(["-5.00", "495.00"]);
    expect(s2(r.position.realizedPnl)).toBe("490.00");
  });
});

describe("no flip in one execution", () => {
  it("cannot close more than the open short, or open long while short", () => {
    const { position } = run([ex("EQUITY_INTRADAY", "OPEN_SHORT", "100", "1520")]);
    expect(() => applyExecution(position, ex("EQUITY_INTRADAY", "CLOSE_SHORT", "101", "1500"))).toThrow(/only 100\.0000 short/);
    expect(() => applyExecution(position, ex("EQUITY_INTRADAY", "OPEN_LONG", "1", "1500"))).toThrow(/close it before opening LONG/);
    expect(() => applyExecution(position, ex("EQUITY_INTRADAY", "CLOSE_LONG", "1", "1500"))).toThrow(PositionError);
  });

  it("reversal is two executions: close, then open the other side", () => {
    const r = run([
      ex("EQUITY_INTRADAY", "OPEN_LONG", "50", "100"),
      ex("EQUITY_INTRADAY", "CLOSE_LONG", "50", "110"),
      ex("EQUITY_INTRADAY", "OPEN_SHORT", "30", "110"),
    ]);
    expect(r.position.direction).toBe("SHORT");
    expect(r.position.quantity.toDecimalString(4)).toBe("30.0000");
    expect(s2(r.position.realizedPnl)).toBe("500.00");
  });
});

describe("futures and options", () => {
  it("futures short is mark-to-market", () => {
    const r = run([ex("FUTURES", "OPEN_SHORT", "75", "25000"), ex("FUTURES", "CLOSE_SHORT", "75", "24900", "40.00")]);
    expect(r.cash.map(s2)).toEqual(["0.00", "7460.00"]);
    expect(s2(r.position.realizedPnl)).toBe("7460.00");
  });

  it("options long pays premium; short receives premium and is a liability", () => {
    const long = run([ex("OPTIONS", "OPEN_LONG", "75", "120", "20.00")]);
    expect(s2(long.cash[0])).toBe("-9020.00");
    expect(s2(navValue(long.position, "OPTIONS", m("100")))).toBe("7500.00");

    const short = run([ex("OPTIONS", "OPEN_SHORT", "75", "120", "20.00")]);
    expect(s2(short.cash[0])).toBe("8980.00");
    expect(s2(navValue(short.position, "OPTIONS", m("100")))).toBe("-7500.00");
    const closed = applyExecution(short.position, ex("OPTIONS", "CLOSE_SHORT", "75", "100", "20.00"));
    expect(s2(closed.cashDelta)).toBe("-7520.00");
    expect(s2(closed.realized)).toBe("1460.00"); // 9000 - 7500 - 20 - 20
  });
});

describe("replay and exposure", () => {
  const t = (id: number, product: BookTrade["product"], action: BookTrade["action"], qty: string, price: string, date = "2026-09-02"): BookTrade => ({
    id,
    instrumentId: 1,
    tradeDate: date,
    ...ex(product, action, qty, price),
  });

  it("keeps products of one instrument separate", () => {
    const book = replayBook([
      t(1, "EQUITY_DELIVERY", "OPEN_LONG", "10", "1500"),
      t(2, "EQUITY_INTRADAY", "OPEN_SHORT", "100", "1520"),
    ]);
    expect(book.get("1:EQUITY_DELIVERY")?.position.direction).toBe("LONG");
    expect(book.get("1:EQUITY_INTRADAY")?.position.direction).toBe("SHORT");
  });

  it("replays in (date, id) order and names the failing trade", () => {
    try {
      replayBook([t(2, "EQUITY_DELIVERY", "CLOSE_LONG", "5", "100", "2026-09-01"), t(1, "EQUITY_DELIVERY", "OPEN_LONG", "5", "100", "2026-09-02")]);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(PositionError);
      expect((err as PositionError).tradeId).toBe(2);
    }
  });

  it("long, short, gross and net exposure", () => {
    const long = run([ex("EQUITY_DELIVERY", "OPEN_LONG", "10", "100")]).position;
    const short = run([ex("EQUITY_INTRADAY", "OPEN_SHORT", "5", "200")]).position;
    const e = exposure([
      { position: long, price: m("110") },
      { position: short, price: m("190") },
    ]);
    expect([e.long, e.short, e.gross, e.net].map(s2)).toEqual(["1100.00", "950.00", "2050.00", "150.00"]);
  });
});
