// Request parsing for a trade ticket (create and preview share it).
import { Money } from "@/lib/accounting/money";
import { POSITION_ACTIONS, PRODUCTS, sideFor, type PositionAction } from "@/lib/accounting/positions";
import type { TradeSide } from "@/lib/accounting/trades";
import { parseDecimal, parseEnum, parseId, parseIsoDate, parseOptionalDecimal } from "@/lib/fund/validation";

const SIDES: readonly TradeSide[] = ["BUY", "SELL"];

/**
 * The execution fields shared by create and preview. `product` defaults to
 * EQUITY_DELIVERY; `action` defaults from `side` for delivery only
 * (BUY = OPEN_LONG, SELL = CLOSE_LONG), the pre-012 behaviour. Every other
 * product must name its action explicitly: a SELL is never assumed to
 * close (or open) anything.
 */
export function parseTicket(body: Record<string, unknown>) {
  const product = body.product === undefined ? "EQUITY_DELIVERY" : parseEnum(body.product, "product", PRODUCTS);
  const side = body.side === undefined ? null : parseEnum(body.side, "side", SIDES);
  let action: PositionAction;
  if (body.action !== undefined) action = parseEnum(body.action, "action", POSITION_ACTIONS);
  else if (product === "EQUITY_DELIVERY" && side) action = side === "BUY" ? "OPEN_LONG" : "CLOSE_LONG";
  else action = parseEnum(body.action, "action", POSITION_ACTIONS); // throws: required
  const charge = (key: string) => parseOptionalDecimal(body[key], { label: key, scale: 2 }) ?? Money.zero();
  return {
    instrumentId: parseId(body.instrumentId, "instrumentId"),
    product,
    action,
    side: side ?? sideFor(action),
    tradeDate: parseIsoDate(body.tradeDate, "tradeDate"),
    quantity: parseDecimal(body.quantity, { label: "quantity", scale: 4, positive: true }),
    price: parseDecimal(body.price, { label: "price", scale: 4, positive: true }),
    charges: {
      brokerage: charge("brokerage"),
      stt: charge("stt"),
      gst: charge("gst"),
      stampDuty: charge("stampDuty"),
      otherCharges: charge("otherCharges"),
    },
  };
}

