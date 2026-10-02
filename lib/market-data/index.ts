// Single entry point for market data. Services call getMarketDataProvider()
// with the provider name stored in qfinera_fund_settings.market_data_provider;
// they never import a vendor adapter directly. Adding a vendor means adding
// one adapter that implements MarketDataProvider and one case below.
import type { Db } from "@/lib/fund/db";
import { createSnapshotProvider } from "@/lib/market-data/snapshot-provider";
import type { MarketDataProvider } from "@/lib/market-data/types";

export type {
  AvailableQuote,
  DateRange,
  Exchange,
  HistoricalPrice,
  InstrumentRef,
  MarketDataProvider,
  MarketStatus,
  Quote,
  QuoteQuality,
  TradingDay,
  UnavailableQuote,
} from "@/lib/market-data/types";

export type ProviderDeps = {
  db: Db;
  /** The fund asking; scopes manually recorded prices to that fund. */
  fundId?: number | null;
  holidays?: readonly string[];
};

export const SUPPORTED_MARKET_DATA_PROVIDERS = ["manual"] as const;

/** Throws for an unknown name: a misconfigured provider must be loud, not silently replaced. */
export function getMarketDataProvider(name: string, deps: ProviderDeps): MarketDataProvider {
  switch (name) {
    case "manual":
      return createSnapshotProvider({ db: deps.db, fundId: deps.fundId, holidays: deps.holidays });
    default:
      throw new Error(
        `Unknown market data provider "${name}". Supported: ${SUPPORTED_MARKET_DATA_PROVIDERS.join(", ")}.`
      );
  }
}
