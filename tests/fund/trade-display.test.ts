import { describe, expect, it } from "vitest";
import { editNeedsBackdateConfirm, isMarkToMarket, newTradeNeedsCorrection, tradeHeadlineValue } from "@/components/fund/trade-display";

describe("trade display", () => {
  it("intraday and futures show exposure (quantity x price), not cash spent", () => {
    expect(isMarkToMarket("EQUITY_INTRADAY")).toBe(true);
    expect(isMarkToMarket("FUTURES")).toBe(true);
    expect(tradeHeadlineValue({ product: "EQUITY_INTRADAY", gross_value: "14262.60", net_value: "14301.40" })).toEqual({ label: "Exposure", value: "14262.60" });
  });

  it("delivery and options show the net value that actually changes hands", () => {
    expect(isMarkToMarket("EQUITY_DELIVERY")).toBe(false);
    expect(isMarkToMarket("OPTIONS")).toBe(false);
    expect(tradeHeadlineValue({ product: "EQUITY_DELIVERY", gross_value: "1000.00", net_value: "1020.00" })).toEqual({ label: "Net value", value: "1020.00" });
  });

  it("a new trade shows correction fields only when backdated (or the server asks)", () => {
    expect(newTradeNeedsCorrection(null, false)).toBe(false);
    expect(newTradeNeedsCorrection({ backdated: false }, false)).toBe(false);
    expect(newTradeNeedsCorrection({ backdated: true }, false)).toBe(true);
    expect(newTradeNeedsCorrection({ backdated: false }, true)).toBe(true);
  });

  it("an edit needs the backdate confirmation only when it reaches an official NAV", () => {
    expect(editNeedsBackdateConfirm("2026-09-05", "2026-09-05", null)).toBe(false);
    expect(editNeedsBackdateConfirm("2026-09-05", "2026-09-05", "2026-09-01")).toBe(false);
    expect(editNeedsBackdateConfirm("2026-09-05", "2026-09-01", "2026-09-01")).toBe(true);
    expect(editNeedsBackdateConfirm("2026-09-01", "2026-09-05", "2026-09-01")).toBe(true);
  });
});
