// Money abstraction for QFinera Fund accounting \u2014 the ONLY place BigInt
// fixed-point arithmetic should exist in the application. Every accounting
// calculation (contributions, withdrawals, trades, NAV, ledger entries)
// must go through this module rather than raw `number` arithmetic. See
// docs/qfinera-fund/ACCOUNTING_RULES.md for the full precision contract;
// summarized here:
//
//   - Money (rupee amounts): 2 decimal places at the accounting boundary.
//   - NAV and units: 4 decimal places at the accounting boundary.
//   - Internally, every Money value is carried at INTERNAL_SCALE (8dp) so
//     that a chain of multiply/divide operations (e.g. quantity \u00d7 price,
//     amount \u00f7 NAV) doesn't lose precision before the final `.round()`
//     call at whichever boundary scale the caller actually needs. Rounding
//     happens exactly once, at the point a value is about to be stored or
//     displayed \u2014 never silently mid-calculation.
//
// Never construct a Money from a floating-point `number` for an
// authoritative value \u2014 `fromDecimalString` takes a string specifically
// so a value that already lost precision as a JS float (e.g. 0.1 + 0.2)
// can never enter this system already corrupted. UI code may convert a
// Money to a `number` for display-only purposes via `toDecimalString`,
// but that string/number must never be fed back into accounting logic.
import { rescaleBigInt } from "./rounding";

// Scale 8 exists only so a rounding residual (see units.ts) can be
// persisted/displayed at full internal precision; 2 and 4 are the
// accounting boundary scales.
export type MoneyScale = 2 | 4 | 8;

const INTERNAL_SCALE = 8;
const INTERNAL_FACTOR = 10n ** BigInt(INTERNAL_SCALE);

export class Money {
  private constructor(private readonly internal: bigint) {}

  static zero(): Money {
    return new Money(0n);
  }

  /**
   * Parses a plain decimal string ("1234.5678", "-10", "0.00") into a
   * Money at full internal precision. Throws on anything that isn't a
   * clean, unambiguous decimal number \u2014 no scientific notation, no
   * thousands separators, no leading "+", no empty string. This
   * strictness is deliberate: an accounting input parser should reject
   * anything it isn't certain about rather than guess.
   */
  static fromDecimalString(value: string): Money {
    const trimmed = value.trim();
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
    if (!match) {
      throw new Error(`Money.fromDecimalString: "${value}" is not a valid decimal amount`);
    }
    const [, sign, integerPart, fractionPart = ""] = match;

    if (fractionPart.length > INTERNAL_SCALE) {
      throw new Error(
        `Money.fromDecimalString: "${value}" has more than ${INTERNAL_SCALE} decimal places, which exceeds internal precision`
      );
    }

    const paddedFraction = fractionPart.padEnd(INTERNAL_SCALE, "0");
    const magnitude = BigInt(integerPart + paddedFraction);
    const internal = sign === "-" ? -magnitude : magnitude;

    // Reject "-0.00" style inputs producing a negative zero internally \u2014
    // harmless numerically (BigInt has no signed zero) but included here
    // as an explicit guard so the invariant "internal is negative iff the
    // value is truly negative" always holds for equals()/isNegative().
    return new Money(internal === 0n ? 0n : internal);
  }

  /** Internal constructor for other accounting modules that already have
   * a correctly-scaled BigInt (e.g. reading a NUMERIC column back via
   * pg, which returns a decimal string \u2014 route it through
   * fromDecimalString instead of this in that case). Exists so rounding.ts
   * and future accounting modules aren't forced through string parsing
   * for values they already computed correctly. */
  static fromInternal(internal: bigint): Money {
    return new Money(internal);
  }

  add(other: Money): Money {
    return new Money(this.internal + other.internal);
  }

  subtract(other: Money): Money {
    return new Money(this.internal - other.internal);
  }

  /** Multiplies two Money values. Note the result's *meaning* depends on
   * context (e.g. quantity \u00d7 price = a rupee amount, not a "squared"
   * unit) \u2014 this class doesn't track units of measure, callers must. */
  multiply(other: Money): Money {
    return new Money((this.internal * other.internal) / INTERNAL_FACTOR);
  }

  /** Multiplies by a plain integer scalar without going through
   * fromDecimalString \u2014 useful for things like "\u00d7 100" GST-style
   * percentage math where the multiplier is exact. */
  multiplyByInt(n: bigint): Money {
    return new Money(this.internal * n);
  }

  divide(other: Money): Money {
    if (other.internal === 0n) {
      throw new Error("Money.divide: division by zero");
    }
    return new Money((this.internal * INTERNAL_FACTOR) / other.internal);
  }

  /** -1 if this < other, 0 if equal, 1 if this > other. */
  compare(other: Money): -1 | 0 | 1 {
    if (this.internal < other.internal) return -1;
    if (this.internal > other.internal) return 1;
    return 0;
  }

  equals(other: Money): boolean {
    return this.internal === other.internal;
  }

  isNegative(): boolean {
    return this.internal < 0n;
  }

  isZero(): boolean {
    return this.internal === 0n;
  }

  /** Rounds to an accounting boundary scale (HALF_UP), returning a new
   * Money that is still internally 8dp but exactly representable at
   * `scale` decimals (all digits beyond `scale` are zero). Idempotent:
   * rounding an already-rounded value to the same scale is a no-op. */
  round(scale: MoneyScale): Money {
    const narrowed = rescaleBigInt(this.internal, INTERNAL_SCALE, scale);
    const backToInternal = rescaleBigInt(narrowed, scale, INTERNAL_SCALE);
    return new Money(backToInternal);
  }

  /** Renders at the given accounting scale as a plain decimal string
   * ("1234.56"), suitable for a NUMERIC column parameter or display.
   * Always rounds first \u2014 callers never need to remember to call
   * .round() before .toDecimalString(); doing both here makes the
   * combination impossible to get wrong or forget. */
  toDecimalString(scale: MoneyScale): string {
    const scaled = rescaleBigInt(this.internal, INTERNAL_SCALE, scale);
    const negative = scaled < 0n;
    const abs = negative ? -scaled : scaled;
    const str = abs.toString().padStart(scale + 1, "0");
    // MoneyScale is always 2, 4 or 8, so there is always a fractional part.
    const integerPart = str.slice(0, -scale);
    const fractionPart = str.slice(-scale);
    return `${negative ? "-" : ""}${integerPart}.${fractionPart}`;
  }
}
