// Position engine for QFinera Fund: executions -> positions. Pure, Money only.
//
// A TRADE is an execution (side BUY/SELL, quantity, price, charges). A
// POSITION is the exposure that executions build, keyed by
// (instrument, product). The position action on each execution says what
// it does to that position; the side is implied by it:
//
//   OPEN_LONG  = BUY     CLOSE_LONG  = SELL
//   OPEN_SHORT = SELL    CLOSE_SHORT = BUY
//
// Rules (docs/qfinera-fund/ACCOUNTING_RULES.md section 10):
//   * Average cost. Opening charges are capitalized into the position;
//     closing charges reduce the closing proceeds (long) or add to the
//     closing cost (short).
//   * A partial close removes round2(basis x closeQty / qty) of the basis;
//     a full close removes ALL of it, so a closed position has no residue.
//   * A position never crosses zero in one execution: closing more than is
//     open is refused, and opening the opposite side while a position is
//     open is refused. Reversal = close, then open (two executions).
//   * EQUITY_DELIVERY is long-only (no short delivery).
//
// Cash settlement depends on the product:
//   PREMIUM  (EQUITY_DELIVERY, OPTIONS) the full traded value moves:
//            BUY  cash -= gross + charges;  SELL cash += gross - charges.
//            A short option's premium is received in cash and the open
//            short is a liability valued at market.
//   MTM      (EQUITY_INTRADAY, FUTURES) no notional moves: opening costs
//            only its charges; a close settles the price difference minus
//            its charges. Open positions reach NAV as their unrealized
//            price difference. No margin or leverage is modelled.
import { Money } from "./money";
import { sortTrades } from "./portfolio";
import { tradeGross, type TradeSide } from "./trades";

export const PRODUCTS = ["EQUITY_DELIVERY", "EQUITY_INTRADAY", "FUTURES", "OPTIONS"] as const;
export type Product = (typeof PRODUCTS)[number];

export const POSITION_ACTIONS = ["OPEN_LONG", "OPEN_SHORT", "CLOSE_LONG", "CLOSE_SHORT"] as const;
export type PositionAction = (typeof POSITION_ACTIONS)[number];

export type Direction = "LONG" | "SHORT";
export type Settlement = "PREMIUM" | "MTM";

export function settlementOf(product: Product): Settlement {
  return product === "EQUITY_INTRADAY" || product === "FUTURES" ? "MTM" : "PREMIUM";
}

export function sideFor(action: PositionAction): TradeSide {
  return action === "OPEN_LONG" || action === "CLOSE_SHORT" ? "BUY" : "SELL";
}

export function directionOf(action: PositionAction): Direction {
  return action === "OPEN_LONG" || action === "CLOSE_LONG" ? "LONG" : "SHORT";
}

export function isOpening(action: PositionAction): boolean {
  return action === "OPEN_LONG" || action === "OPEN_SHORT";
}

/** Product/action combinations that are not allowed, or null if fine. */
export function invalidCombination(product: Product, action: PositionAction, side?: TradeSide | null): string | null {
  if (side && side !== sideFor(action)) {
    return `${action.replace("_", " ").toLowerCase()} is a ${sideFor(action)}, not a ${side}.`;
  }
  if (product === "EQUITY_DELIVERY" && directionOf(action) === "SHORT") {
    return "Equity delivery is long-only. Use intraday to short an equity.";
  }
  return null;
}

export type BookPosition = {
  direction: Direction | null;
  quantity: Money;
  /** Sum of quantity x entry price for the open quantity, 2dp. */
  entryGross: Money;
  /** Opening charges still capitalized in the open quantity, 2dp. */
  openCharges: Money;
  /** Cumulative realized P&L over the position's life, 2dp. */
  realizedPnl: Money;
  /** Cumulative charges of every execution on this position, 2dp. */
  chargesPaid: Money;
};

export type Execution = {
  product: Product;
  action: PositionAction;
  quantity: Money;
  price: Money;
  /** Total of all charge components, 2dp, >= 0. */
  charges: Money;
};

export type ExecutionEffect = {
  position: BookPosition;
  gross: Money;
  /** Signed cash movement on the trade date, 2dp. */
  cashDelta: Money;
  /** Realized P&L booked by this execution (0 for an open), 2dp. */
  realized: Money;
};

export class PositionError extends Error {
  /** Set by replayBook: the execution that could not be applied. */
  tradeId?: number;
  instrumentId?: number;
}

export function emptyBookPosition(): BookPosition {
  const z = Money.zero();
  return { direction: null, quantity: z, entryGross: z, openCharges: z, realizedPnl: z, chargesPaid: z };
}

const fmtQty = (q: Money) => q.toDecimalString(4);

export function applyExecution(position: BookPosition, ex: Execution): ExecutionEffect {
  const bad = invalidCombination(ex.product, ex.action);
  if (bad) throw new PositionError(bad);
  if (ex.charges.isNegative()) throw new PositionError("charges must be zero or more");
  const gross = tradeGross(ex.quantity, ex.price);
  const charges = ex.charges.round(2);
  const dir = directionOf(ex.action);
  const settlement = settlementOf(ex.product);

  if (isOpening(ex.action)) {
    if (position.direction && position.direction !== dir && !position.quantity.isZero()) {
      throw new PositionError(
        `the position is ${position.direction} ${fmtQty(position.quantity)}; close it before opening ${dir}`
      );
    }
    const cashDelta =
      settlement === "MTM"
        ? Money.zero().subtract(charges)
        : dir === "LONG"
          ? Money.zero().subtract(gross.add(charges))
          : gross.subtract(charges);
    return {
      position: {
        direction: dir,
        quantity: position.quantity.add(ex.quantity),
        entryGross: position.entryGross.add(gross),
        openCharges: position.openCharges.add(charges),
        realizedPnl: position.realizedPnl,
        chargesPaid: position.chargesPaid.add(charges),
      },
      gross,
      cashDelta,
      realized: Money.zero(),
    };
  }

  // Closing.
  if (position.direction !== dir || position.quantity.isZero()) {
    throw new PositionError(
      dir === "LONG"
        ? `cannot sell ${fmtQty(ex.quantity)}: only 0.0000 held`
        : `there is no open SHORT position to close`
    );
  }
  if (ex.quantity.compare(position.quantity) > 0) {
    throw new PositionError(
      dir === "LONG"
        ? `cannot sell ${fmtQty(ex.quantity)}: only ${fmtQty(position.quantity)} held`
        : `cannot buy back ${fmtQty(ex.quantity)}: only ${fmtQty(position.quantity)} short`
    );
  }
  const full = ex.quantity.equals(position.quantity);
  const share = (v: Money) => (full ? v : v.multiply(ex.quantity).divide(position.quantity).round(2));
  // Remove the basis as one rounded amount, then split it, so the long
  // side matches lib/accounting/holdings.ts applySell to the paisa.
  const basis = dir === "LONG" ? position.entryGross.add(position.openCharges) : position.entryGross.subtract(position.openCharges);
  const basisOut = share(basis);
  const grossOut = share(position.entryGross);
  const chargesOut = dir === "LONG" ? basisOut.subtract(grossOut) : grossOut.subtract(basisOut);

  const realized =
    dir === "LONG"
      ? gross.subtract(charges).subtract(basisOut)
      : basisOut.subtract(gross.add(charges));
  const cashDelta =
    settlement === "MTM"
      ? (dir === "LONG" ? gross.subtract(grossOut) : grossOut.subtract(gross)).subtract(charges)
      : dir === "LONG"
        ? gross.subtract(charges)
        : Money.zero().subtract(gross.add(charges));

  const quantity = position.quantity.subtract(ex.quantity);
  return {
    position: {
      direction: quantity.isZero() ? null : dir,
      quantity,
      entryGross: position.entryGross.subtract(grossOut),
      openCharges: position.openCharges.subtract(chargesOut),
      realizedPnl: position.realizedPnl.add(realized),
      chargesPaid: position.chargesPaid.add(charges),
    },
    gross,
    cashDelta,
    realized,
  };
}

/** Average entry price, 4dp (excludes charges), or null when flat. */
export function averageEntryPrice(p: BookPosition): Money | null {
  return p.quantity.isZero() ? null : p.entryGross.divide(p.quantity).round(4);
}

/** Cost basis incl. capitalized charges: long = paid, short = net proceeds. */
export function costBasis(p: BookPosition): Money {
  return p.direction === "SHORT" ? p.entryGross.subtract(p.openCharges) : p.entryGross.add(p.openCharges);
}

/** round2(quantity x price): absolute notional / premium value. */
export function notional(p: BookPosition, price: Money): Money {
  return p.quantity.multiply(price).round(2);
}

/** Unrealized P&L at `price` (net of capitalized opening charges). */
export function unrealized(p: BookPosition, price: Money): Money {
  if (p.quantity.isZero()) return Money.zero();
  const value = notional(p, price);
  return p.direction === "SHORT" ? costBasis(p).subtract(value) : value.subtract(costBasis(p));
}

/**
 * What the open position contributes to Fund Value at `price` (signed):
 *   PREMIUM long  +notional (an asset)      PREMIUM short -notional (a liability)
 *   MTM           the unrealized price difference (charges already left cash)
 */
export function navValue(p: BookPosition, product: Product, price: Money): Money {
  if (p.quantity.isZero()) return Money.zero();
  const value = notional(p, price);
  if (settlementOf(product) === "PREMIUM") return p.direction === "SHORT" ? Money.zero().subtract(value) : value;
  return p.direction === "SHORT" ? p.entryGross.subtract(value) : value.subtract(p.entryGross);
}

// ------------------------------------------------------------- replay

export type BookTrade = Execution & {
  id: number;
  instrumentId: number;
  /** ISO date. */
  tradeDate: string;
};

export function positionKey(instrumentId: number, product: Product): string {
  return `${instrumentId}:${product}`;
}

export type BookEntry = { instrumentId: number; product: Product; position: BookPosition };

/** Replays executions in (trade date, id) order. Throws PositionError (with the trade id) on an invalid step. */
export function replayBook(trades: readonly BookTrade[]): Map<string, BookEntry> {
  const book = new Map<string, BookEntry>();
  for (const t of sortTrades(trades)) {
    const key = positionKey(t.instrumentId, t.product);
    const current = book.get(key) ?? { instrumentId: t.instrumentId, product: t.product, position: emptyBookPosition() };
    let effect: ExecutionEffect;
    try {
      effect = applyExecution(current.position, t);
    } catch (err) {
      if (err instanceof PositionError) {
        err.tradeId = t.id;
        err.instrumentId = t.instrumentId;
      }
      throw err;
    }
    book.set(key, { ...current, position: effect.position });
  }
  return book;
}

/** The position just before trade `id` would apply (for previews and MTM cash). */
export function positionBefore(trades: readonly BookTrade[], key: string): BookPosition {
  return replayBook(trades).get(key)?.position ?? emptyBookPosition();
}

export type Exposure = { long: Money; short: Money; gross: Money; net: Money };

/** Notional exposure at the given prices; positions without a price are skipped (caller reports them). */
export function exposure(entries: ReadonlyArray<{ position: BookPosition; price: Money | null }>): Exposure {
  let long = Money.zero();
  let short = Money.zero();
  for (const { position, price } of entries) {
    if (!price || position.quantity.isZero()) continue;
    if (position.direction === "SHORT") short = short.add(notional(position, price));
    else long = long.add(notional(position, price));
  }
  return { long, short, gross: long.add(short), net: long.subtract(short) };
}
