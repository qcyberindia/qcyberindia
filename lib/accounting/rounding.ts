// Deterministic, dependency-free fixed-point rounding for QFinera Fund
// accounting. Pure functions only \u2014 no Money/BigInt class logic lives
// here, just the scale-conversion math money.ts builds on.
//
// Rounding mode: HALF_UP (round half away from zero) \u2014 the conventional
// choice for financial rounding (as opposed to banker's rounding /
// HALF_EVEN) and the one this module implements exclusively for MVP V1.
// If a future requirement needs HALF_EVEN for a specific regulatory
// calculation, add it as a second named function here rather than a mode
// flag threaded through every call site \u2014 most of this codebase will only
// ever need HALF_UP.

/**
 * Converts a BigInt value expressed at `fromScale` decimal places to one
 * expressed at `toScale` decimal places, rounding HALF_UP when narrowing.
 * Widening (toScale > fromScale) is exact \u2014 it's pure zero-padding, never
 * loses information, so there's nothing to round.
 *
 * Worked example: rescaleBigInt(125n, 3, 2) treats 125n as 0.125 at 3dp;
 * dropping the last digit (a remainder of exactly half a unit at the new
 * scale) rounds up: returns 13n (0.13 at 2dp).
 */
export function rescaleBigInt(value: bigint, fromScale: number, toScale: number): bigint {
  if (fromScale === toScale) return value;

  if (toScale > fromScale) {
    return value * 10n ** BigInt(toScale - fromScale);
  }

  const dropped = fromScale - toScale;
  const divisor = 10n ** BigInt(dropped);
  const negative = value < 0n;
  const abs = negative ? -value : value;

  const quotient = abs / divisor;
  const remainder = abs % divisor;
  const halfway = divisor / 2n; // divisor is always a power of 10 >= 10, so this is exact

  // HALF_UP: round away from zero when the dropped remainder is at least
  // half of one unit at the new scale.
  const rounded = remainder >= halfway ? quotient + 1n : quotient;

  return negative ? -rounded : rounded;
}
