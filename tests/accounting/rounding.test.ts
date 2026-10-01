import { describe, expect, it } from "vitest";
import { rescaleBigInt } from "../../lib/accounting/rounding";

describe("rescaleBigInt", () => {
  it("rounds exact halves up when narrowing", () => {
    expect(rescaleBigInt(125n, 3, 2)).toBe(13n);
    expect(rescaleBigInt(124n, 3, 2)).toBe(12n);
    expect(rescaleBigInt(5n, 1, 0)).toBe(1n);
    expect(rescaleBigInt(4n, 1, 0)).toBe(0n);
  });

  it("rounds negative values away from zero (symmetric HALF_UP)", () => {
    expect(rescaleBigInt(-125n, 3, 2)).toBe(-13n);
    expect(rescaleBigInt(-124n, 3, 2)).toBe(-12n);
    expect(rescaleBigInt(-5n, 1, 0)).toBe(-1n);
  });

  it("widens exactly by zero-padding", () => {
    expect(rescaleBigInt(13n, 2, 4)).toBe(1300n);
    expect(rescaleBigInt(-13n, 2, 4)).toBe(-1300n);
  });

  it("is a no-op when scales match", () => {
    expect(rescaleBigInt(12345n, 4, 4)).toBe(12345n);
  });
});
