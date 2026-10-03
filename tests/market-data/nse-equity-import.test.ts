import { describe, expect, it } from "vitest";
import { isValidIsin, normalizeSpace, parseCsv, parseEquityList, parseNseDate } from "@/lib/market-data/nse-equity-import";

// Header exactly as NSE publishes it (leading spaces included).
const HEADER = "SYMBOL,NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE";
const csv = (...rows: string[]) => [HEADER, ...rows].join("\r\n") + "\r\n";

describe("NSE equity list parsing", () => {
  it("maps every column and normalizes whitespace", () => {
    const r = parseEquityList(csv("INFY,  Infosys   Limited ,EQ,08-FEB-1995,5,1, INE009A01021 ,5"));
    expect(r.rejected).toEqual([]);
    expect(r.rows).toEqual([
      {
        line: 2,
        symbol: "INFY",
        name: "Infosys Limited",
        series: "EQ",
        listingDate: "1995-02-08",
        paidUpValue: "5",
        lotSize: 1,
        isin: "INE009A01021",
        faceValue: "5",
      },
    ]);
  });

  it("keeps every series verbatim and counts the distribution", () => {
    const r = parseEquityList(
      csv(
        "INFY,Infosys Limited,EQ,08-FEB-1995,5,1,INE009A01021,5",
        "TCS,Tata Consultancy Services Limited,EQ,25-AUG-2004,1,1,INE467B01029,1",
        "BEROW,Some BE Co,BE,01-JAN-2020,10,1,INE144J01027,10",
        "BZROW,Some BZ Co,BZ,01-JAN-2020,10,1,INE253B01015,10"
      )
    );
    expect(r.seriesDistribution).toEqual({ EQ: 2, BE: 1, BZ: 1 });
    expect(r.rows.map((x) => x.series)).toEqual(["EQ", "EQ", "BE", "BZ"]);
  });

  it("rejects all occurrences of a duplicate symbol or ISIN", () => {
    const r = parseEquityList(
      csv(
        "INFY,Infosys Limited,EQ,08-FEB-1995,5,1,INE009A01021,5",
        "INFY,Infosys again,BE,08-FEB-1995,5,1,INE467B01029,5",
        "AAA,A Ltd,EQ,01-JAN-2020,10,1,INE144J01027,10",
        "BBB,B Ltd,EQ,01-JAN-2020,10,1,INE144J01027,10",
        "TCS,TCS Ltd,EQ,25-AUG-2004,1,1,INE253B01015,1"
      )
    );
    expect(r.duplicateSymbols).toEqual(["INFY"]);
    expect(r.duplicateIsins).toEqual(["INE144J01027"]);
    expect(r.rows.map((x) => x.symbol)).toEqual(["TCS"]);
    expect(r.rejected.map((x) => x.line)).toEqual([2, 3, 4, 5]);
  });

  it("rejects malformed rows instead of guessing", () => {
    const r = parseEquityList(
      csv(
        "BAD SYM,X,EQ,01-JAN-2020,10,1,INE009A01021,10",
        "X1,X,EQ,01-JAN-2020,10,1,INE009A01022,10", // bad check digit
        "X2,X,EQ,31-FEB-2020,10,1,INE009A01021,10",
        "X3,X,EQ,01-JAN-2020,10,0,INE009A01021,10",
        "X4,,EQ,01-JAN-2020,10,1,INE009A01021,10",
        "X5,X,EQ,01-JAN-2020,abc,1,INE009A01021,10",
        "X6,X,EQ,01-JAN-2020,10,1"
      )
    );
    expect(r.rows).toEqual([]);
    expect(r.totalRows).toBe(7);
    expect(r.rejected).toHaveLength(7);
  });

  it("accepts symbols with & and - and quoted names with commas", () => {
    const r = parseEquityList(csv('M&M,"Mahindra & Mahindra, Limited",EQ,01-JAN-2000,5,1,INE101A01026,5'));
    expect(r.rows[0]).toMatchObject({ symbol: "M&M", name: "Mahindra & Mahindra, Limited" });
  });

  it("fails loudly when a required column is missing", () => {
    expect(() => parseEquityList("SYMBOL,NAME OF COMPANY\nINFY,Infosys\n")).toThrow(/SERIES/);
  });
});

describe("helpers", () => {
  it("validates ISIN check digits", () => {
    expect(isValidIsin("INE009A01021")).toBe(true);
    expect(isValidIsin("US0378331005")).toBe(true);
    expect(isValidIsin("INE009A01020")).toBe(false);
    expect(isValidIsin("ine009a01021")).toBe(false);
  });

  it("parses NSE dates strictly", () => {
    expect(parseNseDate("06-OCT-2008")).toBe("2008-10-06");
    expect(parseNseDate("6-Oct-2008")).toBe("2008-10-06");
    expect(parseNseDate("29-FEB-2023")).toBeNull();
    expect(parseNseDate("2008-10-06")).toBeNull();
  });

  it("parses CSV quoting and blank lines", () => {
    expect(parseCsv('a,"b ""c""",d\n\n1,2,3')).toEqual([["a", 'b "c"', "d"], ["1", "2", "3"]]);
    expect(normalizeSpace("  a   b\t c ")).toBe("a b c");
  });
});
