import { describe, expect, it } from "vitest";
import { Money } from "../../lib/accounting/money";
import { memberValue, navChange, ownershipPercent, weightPercent } from "../../lib/fund/metrics";
import {
  formatCalendarDate,
  formatMoney,
  formatNav,
  formatPercent,
  formatTimestampIst,
  formatUnits,
  formatXirr,
  groupIndian,
} from "../../components/fund/format";

const m = (s: string) => Money.fromDecimalString(s);

describe("fund metrics", () => {
  it("ownership percent at 2dp, null without units", () => {
    expect(ownershipPercent(m("250.0000"), m("1000.0000"))?.toDecimalString(2)).toBe("25.00");
    expect(ownershipPercent(m("1.0000"), m("3.0000"))?.toDecimalString(2)).toBe("33.33");
    expect(ownershipPercent(m("1.0000"), Money.zero())).toBeNull();
  });

  it("member value = round2(units x NAV); null without an official NAV", () => {
    expect(memberValue(m("100.5000"), m("10.1234"))?.toDecimalString(2)).toBe("1017.40");
    expect(memberValue(m("100.0000"), null)).toBeNull();
  });

  it("NAV change, absolute and percent", () => {
    const c = navChange(m("10.5000"), m("10.0000"));
    expect(c.absolute.toDecimalString(4)).toBe("0.5000");
    expect(c.percent?.toDecimalString(2)).toBe("5.00");
    expect(navChange(m("9.0000"), m("10.0000")).absolute.toDecimalString(4)).toBe("-1.0000");
    expect(navChange(m("1.0000"), Money.zero()).percent).toBeNull();
  });

  it("portfolio weight", () => {
    expect(weightPercent(m("2500.00"), m("10000.00"))?.toDecimalString(2)).toBe("25.00");
    expect(weightPercent(m("1.00"), Money.zero())).toBeNull();
  });
});

describe("formatting", () => {
  it("groups digits the Indian way", () => {
    expect(groupIndian("123")).toBe("123");
    expect(groupIndian("1234")).toBe("1,234");
    expect(groupIndian("12345")).toBe("12,345");
    expect(groupIndian("123456")).toBe("1,23,456");
    expect(groupIndian("1234567")).toBe("12,34,567");
  });

  it("formats money with sign handling and N/A for missing values", () => {
    expect(formatMoney("1234567.5")).toBe("\u20B912,34,567.50");
    expect(formatMoney("-1234567.5")).toBe("-\u20B912,34,567.50");
    expect(formatMoney("1234.5", true)).toBe("+\u20B91,234.50");
    expect(formatMoney("0", true)).toBe("\u20B90.00");
    expect(formatMoney(null)).toBe("N/A");
    expect(formatMoney("not a number")).toBe("N/A");
  });

  it("formats NAV and units at 4dp, percent at 2dp", () => {
    expect(formatNav("10.1234")).toBe("\u20B910.1234");
    expect(formatUnits("1000")).toBe("1,000.0000");
    expect(formatPercent("25")).toBe("25.00%");
    expect(formatPercent("2.5", true)).toBe("+2.50%");
  });

  it("formats dates and IST timestamps", () => {
    expect(formatCalendarDate("2026-10-01")).toBe("01 Oct 2026");
    expect(formatCalendarDate(null)).toBe("-");
    expect(formatTimestampIst(new Date("2026-10-01T10:30:00Z"))).toBe("01 Oct 2026, 16:00 IST");
  });

  it("formats XIRR for display and shows N/A when unsolvable", () => {
    expect(formatXirr(0.1)).toBe("10.00%");
    expect(formatXirr(null)).toBe("N/A");
    expect(formatXirr(Number.NaN)).toBe("N/A");
  });
});
