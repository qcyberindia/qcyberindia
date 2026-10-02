// Average-cost position accounting for one instrument in one fund. Pure
// functions; every method returns a new Position and never mutates.
//
// Rules:
//   - Buy: quantity increases; cost basis increases by gross + charges
//     (buy charges are capitalized).
//   - Sell: proceeds = gross - charges. Cost removed = the average cost of
//     the units sold: round2(costBasis x sellQty / quantity). A full sell
//     removes the ENTIRE remaining cost basis (no rounding drift), so a
//     position that reaches zero quantity always has zero cost basis.
//   - Realized P&L accumulates across the position's life (a rebuy after
//     zero keeps prior realized P&L). Unrealized P&L is derived on demand
//     from a price and is never stored here.
//   - Overselling throws.
import { Money } from "./money";
import { tradeGross } from "./trades";

export type Position = {
  quantity: Money;
  /** Total cost of the units currently held, 2dp. */
  costBasis: Money;
  /** Cumulative realized P&L, 2dp. */
  realizedPnl: Money;
};

export type PositionTrade = {
  quantity: Money;
  price: Money;
  /** Total of all charge components, 2dp, >= 0. */
  charges: Money;
};

export function emptyPosition(): Position {
  return { quantity: Money.zero(), costBasis: Money.zero(), realizedPnl: Money.zero() };
}

function assertCharges(charges: Money): void {
  if (charges.isNegative()) throw new Error("charges must be zero or more");
}

export function applyBuy(position: Position, trade: PositionTrade): Position {
  assertCharges(trade.charges);
  const cost = tradeGross(trade.quantity, trade.price).add(trade.charges);
  return {
    quantity: position.quantity.add(trade.quantity),
    costBasis: position.costBasis.add(cost).round(2),
    realizedPnl: position.realizedPnl,
  };
}

export function applySell(position: Position, trade: PositionTrade): Position {
  assertCharges(trade.charges);
  const gross = tradeGross(trade.quantity, trade.price);
  if (trade.quantity.compare(position.quantity) > 0) {
    throw new Error(
      `cannot sell ${trade.quantity.toDecimalString(4)}: only ${position.quantity.toDecimalString(4)} held`
    );
  }

  const proceeds = gross.subtract(trade.charges);
  const sellsEverything = trade.quantity.equals(position.quantity);
  const costRemoved = sellsEverything
    ? position.costBasis
    : position.costBasis.multiply(trade.quantity).divide(position.quantity).round(2);

  return {
    quantity: position.quantity.subtract(trade.quantity),
    costBasis: position.costBasis.subtract(costRemoved),
    realizedPnl: position.realizedPnl.add(proceeds.subtract(costRemoved)),
  };
}

/** costBasis / quantity at 4dp, or null when nothing is held. */
export function averageCost(position: Position): Money | null {
  if (position.quantity.isZero()) return null;
  return position.costBasis.divide(position.quantity).round(4);
}

/** round2(quantity x price). */
export function marketValue(position: Position, price: Money): Money {
  return position.quantity.multiply(price).round(2);
}

export function unrealizedPnl(position: Position, price: Money): Money {
  return marketValue(position, price).subtract(position.costBasis);
}
