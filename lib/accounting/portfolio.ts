// Portfolio derivation for QFinera Fund. Pure functions on Money.
//
// Holdings are DERIVED, never stored: replaying the Fund's accounting-
// effective trades in (trade date, id) order through the Phase 1 average-
// cost functions (applyBuy / applySell) yields each instrument's position.
// That keeps holdings reconcilable against the ledger and means there is
// exactly one implementation of position math.
import { Money } from "./money";
import { applyBuy, applySell, emptyPosition, type Position } from "./holdings";
import type { TradeSide } from "./trades";

export type ReplayTrade = {
  id: number;
  instrumentId: number;
  /** ISO date, YYYY-MM-DD. */
  tradeDate: string;
  side: TradeSide;
  quantity: Money;
  price: Money;
  /** Sum of all charge components, 2dp, >= 0. */
  charges: Money;
};

export function sortTrades<T extends Pick<ReplayTrade, "id" | "tradeDate">>(trades: readonly T[]): T[] {
  return [...trades].sort((a, b) =>
    a.tradeDate === b.tradeDate ? a.id - b.id : a.tradeDate < b.tradeDate ? -1 : 1
  );
}

/** Replays trades into one Position per instrument. Throws on an oversell. */
export function replayPositions(trades: readonly ReplayTrade[]): Map<number, Position> {
  const positions = new Map<number, Position>();
  for (const t of sortTrades(trades)) {
    const current = positions.get(t.instrumentId) ?? emptyPosition();
    const next =
      t.side === "BUY"
        ? applyBuy(current, { quantity: t.quantity, price: t.price, charges: t.charges })
        : applySell(current, { quantity: t.quantity, price: t.price, charges: t.charges });
    positions.set(t.instrumentId, next);
  }
  return positions;
}

/** part / total x 100, 2dp HALF_UP, as a decimal string; null if total is zero. */
export function percentOf(part: Money, total: Money): string | null {
  if (total.isZero()) return null;
  return part.divide(total).multiplyByInt(100n).round(2).toDecimalString(2);
}

/** Ownership percentage of a member: units / outstanding x 100, 4dp. */
export function ownershipPercent(memberUnits: Money, outstandingUnits: Money): string | null {
  if (outstandingUnits.isZero()) return null;
  return memberUnits.divide(outstandingUnits).multiplyByInt(100n).round(4).toDecimalString(4);
}
