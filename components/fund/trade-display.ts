// Presentation-only helpers for trade values. No arithmetic on money:
// every amount shown comes from the server's accounting values.

type Product = "EQUITY_DELIVERY" | "EQUITY_INTRADAY" | "FUTURES" | "OPTIONS";

/**
 * Intraday equity and futures are mark-to-market: opening only moves the
 * charges in cash, and the close settles the price difference. Their
 * traded value is exposure, not cash spent. (No margin is modelled.)
 */
export function isMarkToMarket(product: string): boolean {
  return product === "EQUITY_INTRADAY" || product === "FUTURES";
}

export type TradeValue = { label: string; value: string };

/**
 * The headline value for a trade row: exposure (quantity x price) for a
 * mark-to-market product, net value incl. charges for delivery/options,
 * where that is the cash that changes hands.
 */
export function tradeHeadlineValue(t: { product: Product | string; gross_value: string; net_value: string }): TradeValue {
  return isMarkToMarket(t.product) ? { label: "Exposure", value: t.gross_value } : { label: "Net value", value: t.net_value };
}

/** The correction controls belong on a new ticket only when the server says the date needs them. */
export function newTradeNeedsCorrection(preview: { backdated: boolean } | null | undefined, serverAsked: boolean): boolean {
  return serverAsked || Boolean(preview?.backdated);
}

/**
 * Editing an executed trade is always a correction (reason required by the
 * server). The backdate confirmation is needed only when the earliest
 * affected date is on or before the latest official NAV (no official NAV yet: never).
 */
export function editNeedsBackdateConfirm(originalDate: string, newDate: string, latestOfficialNavDate: string | null): boolean {
  if (!latestOfficialNavDate) return false;
  const earliest = newDate && newDate < originalDate ? newDate : originalDate;
  return earliest <= latestOfficialNavDate;
}
