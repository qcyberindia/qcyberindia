// Market data provider abstraction for QFinera Fund.
//
// Business services depend ONLY on this interface, never on a vendor. A
// provider that cannot supply a price must say so (available: false); it
// must never estimate, interpolate, or carry a stale price forward as if
// it were current. Prices are decimal STRINGS (4dp) so they reach Money
// without ever passing through a JavaScript number.

export type Exchange = "NSE" | "BSE";

export type InstrumentRef = {
  instrumentId: number;
  symbol: string;
  exchange: Exchange;
};

/**
 * How trustworthy/fresh a quote is:
 *   LIVE         recorded within the provider's live window
 *   DELAYED      real, but older than the live window (or vendor-delayed)
 *   EOD          an end-of-day closing price
 *   MANUAL       entered by an operator
 * Anything that is not one of these is simply "unavailable" (see Quote).
 */
export type QuoteQuality = "LIVE" | "DELAYED" | "EOD" | "MANUAL";

export type AvailableQuote = {
  available: true;
  instrument: InstrumentRef;
  /** Decimal string, 4dp. */
  price: string;
  quality: QuoteQuality;
  /** Where the price came from (provider/source label). */
  source: string;
  /** ISO timestamp the price refers to. */
  asOf: string;
  /**
   * True when the price predates the most recent completed trading session
   * (it has not been updated since). A stale price is still shown, but
   * always labelled; it is never presented as current.
   */
  stale: boolean;
};

export type UnavailableQuote = {
  available: false;
  instrument: InstrumentRef;
  quality: "UNAVAILABLE";
  /** Plain-language reason, safe to show to a user. */
  reason: string;
};

export type Quote = AvailableQuote | UnavailableQuote;

export type DateRange = {
  /** ISO dates (YYYY-MM-DD), inclusive. */
  from: string;
  to: string;
};

export type HistoricalPrice = {
  /** IST calendar date of the price. */
  date: string;
  price: string;
  quality: Exclude<QuoteQuality, "LIVE" | "DELAYED">;
  source: string;
};

export type MarketStatus = {
  state: "OPEN" | "CLOSED";
  /** Plain-language explanation, e.g. "Weekend" or "Trading hours". */
  reason: string;
  /**
   * "schedule" means the answer is derived from the trading calendar and
   * standard session hours, not from a live exchange feed.
   */
  basis: "schedule" | "exchange-feed";
  at: string;
};

export type TradingDay = {
  date: string;
  isTradingDay: boolean;
  /** Present when it is a configured market holiday. */
  holiday?: true;
};

export interface MarketDataProvider {
  readonly name: string;
  getQuote(instrument: InstrumentRef): Promise<Quote>;
  getQuotes(instruments: readonly InstrumentRef[]): Promise<Quote[]>;
  getHistoricalPrices(instrument: InstrumentRef, range: DateRange): Promise<HistoricalPrice[]>;
  getMarketStatus(at?: Date): Promise<MarketStatus>;
  getTradingCalendar(range: DateRange): Promise<TradingDay[]>;
}
