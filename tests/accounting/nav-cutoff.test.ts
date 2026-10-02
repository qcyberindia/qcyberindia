import { describe, expect, it } from "vitest";
import {
  applicableNavDate,
  cutoffInstant,
  daysBetween,
  isTradingDay,
  nextTradingDay,
  parseCutoffMinutes,
  parseNavCutoffConfig,
  toIstParts,
  DEFAULT_NAV_CUTOFF,
} from "../../lib/accounting/nav-cutoff";

// 2026-10-01 is a Thursday; 10-02 Fri; 10-03 Sat; 10-04 Sun; 10-05 Mon.
// IST = UTC+05:30, so 16:00 IST = 10:30 UTC.

describe("applicableNavDate (16:00 IST default cutoff)", () => {
  it("event exactly at the cutoff on a trading day uses that day's NAV", () => {
    expect(applicableNavDate(new Date("2026-10-01T10:30:00.000Z"))).toBe("2026-10-01");
  });

  it("event one millisecond after the cutoff uses the next trading day", () => {
    expect(applicableNavDate(new Date("2026-10-01T10:30:00.001Z"))).toBe("2026-10-02");
  });

  it("event before the cutoff uses that day's NAV", () => {
    expect(applicableNavDate(new Date("2026-10-01T04:00:00Z"))).toBe("2026-10-01");
  });

  it("a Friday event after the cutoff rolls to Monday", () => {
    expect(applicableNavDate(new Date("2026-10-02T11:00:00Z"))).toBe("2026-10-05");
  });

  it("a weekend event rolls to Monday", () => {
    expect(applicableNavDate(new Date("2026-10-03T05:00:00Z"))).toBe("2026-10-05");
    expect(applicableNavDate(new Date("2026-10-04T05:00:00Z"))).toBe("2026-10-05");
  });

  it("uses the IST calendar date, not the UTC date", () => {
    // 19:00 UTC on 10-01 is 00:30 IST on Friday 10-02, before that day's cutoff.
    expect(applicableNavDate(new Date("2026-10-01T19:00:00Z"))).toBe("2026-10-02");
  });

  it("skips configured market holidays", () => {
    const cfg = { cutoffTimeIst: "16:00", holidays: ["2026-10-02"] };
    expect(applicableNavDate(new Date("2026-10-01T11:00:00Z"), cfg)).toBe("2026-10-05");
    // An event ON a holiday also waits for the next trading day.
    expect(applicableNavDate(new Date("2026-10-02T05:00:00Z"), cfg)).toBe("2026-10-05");
  });

  it("honours a per-fund cutoff", () => {
    const cfg = { cutoffTimeIst: "15:30", holidays: [] };
    expect(applicableNavDate(new Date("2026-10-01T10:00:00.000Z"), cfg)).toBe("2026-10-01");
    expect(applicableNavDate(new Date("2026-10-01T10:01:00.000Z"), cfg)).toBe("2026-10-02");
  });
});

describe("date helpers", () => {
  it("toIstParts", () => {
    expect(toIstParts(new Date("2026-10-01T18:30:00Z"))).toEqual({ date: "2026-10-02", msOfDay: 0 });
    expect(toIstParts(new Date("2026-10-01T10:30:00Z"))).toEqual({ date: "2026-10-01", msOfDay: 16 * 3_600_000 });
  });

  it("parseCutoffMinutes accepts HH:MM only", () => {
    expect(parseCutoffMinutes("16:00")).toBe(960);
    expect(() => parseCutoffMinutes("24:00")).toThrow();
    expect(() => parseCutoffMinutes("9:00")).toThrow();
    expect(() => parseCutoffMinutes("16:60")).toThrow();
  });

  it("isTradingDay / nextTradingDay", () => {
    expect(isTradingDay("2026-10-01", [])).toBe(true);
    expect(isTradingDay("2026-10-03", [])).toBe(false);
    expect(isTradingDay("2026-10-02", ["2026-10-02"])).toBe(false);
    expect(nextTradingDay("2026-10-02", [])).toBe("2026-10-05");
  });

  it("daysBetween and cutoffInstant", () => {
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
    expect(daysBetween("2026-02-01", "2026-01-01")).toBe(-31);
    expect(cutoffInstant("2026-10-01").toISOString()).toBe("2026-10-01T10:30:00.000Z");
  });

  it("rejects invalid calendar dates", () => {
    expect(() => nextTradingDay("2026-02-30", [])).toThrow();
  });
});

describe("parseNavCutoffConfig", () => {
  it("falls back to defaults for missing or invalid settings", () => {
    expect(parseNavCutoffConfig(null)).toEqual(DEFAULT_NAV_CUTOFF);
    expect(parseNavCutoffConfig({ cutoff_time_ist: "late" })).toEqual(DEFAULT_NAV_CUTOFF);
  });

  it("keeps valid holidays and drops invalid ones", () => {
    const cfg = parseNavCutoffConfig({ cutoff_time_ist: "15:45", holidays: ["2026-10-02", "nope", 5] });
    expect(cfg).toEqual({ cutoffTimeIst: "15:45", holidays: ["2026-10-02"] });
  });
});
