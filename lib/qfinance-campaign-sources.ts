/**
 * Source record for factual claims used in /qfinance/why-india-investing.
 * Every FACT-classified claim in the campaign traces back to an entry here.
 * INTERPRETATION and BEHAVIORAL OBSERVATION claims in the campaign copy are
 * deliberately not sourced here — they're framed with hedging language
 * ("may", "can", "one possible reason") in the copy itself instead, per
 * the project's fact/interpretation separation requirement.
 *
 * Research date: 8 September 2026 (see `researchedOn` below). These are
 * fast-moving monthly figures — re-verify before treating any of them as
 * evergreen, and prefer updating this file over hand-editing numbers in
 * the page component.
 */

export const researchedOn = "2026-09-08";

export type CampaignSource = {
  id: string;
  claim: string;
  figure: string;
  asOf: string;
  sourceName: string;
  sourceUrl: string;
  note?: string;
};

export const campaignSources: CampaignSource[] = [
  {
    id: "demat-total",
    claim: "Combined NSDL + CDSL demat account count",
    figure: "~23.15 crore",
    asOf: "30 June 2026",
    sourceName: "NSE/depository data, reported by Sahi News",
    sourceUrl:
      "https://www.sahi.com/news/nse-unique-client-codes-hit-26-crore-as-june-demat-additions-bounce-to-2-5-million-3932-PE1_COR",
    note: "Total accounts, not unique people — see 'unique-investors' below. Up from ~11 crore (Dec 2022) and ~17.1 crore (Aug 2024); this is a fast-growing monthly figure, not a fixed number.",
  },
  {
    id: "unique-investors",
    claim: "NSE unique registered investors (distinct people, not accounts)",
    figure: "~13.1 crore",
    asOf: "31 May 2026",
    sourceName: "NSE data, reported by Business Standard / Business Today",
    sourceUrl:
      "https://www.business-standard.com/markets/capital-market-news/nse-trading-accounts-cross-25-crore-unique-investors-at-12-7-crore-126021300501_1.html",
    note: "Deliberately kept separate from the demat-account total above — one investor can hold multiple demat/trading accounts across brokers, so account counts overstate the number of actual people investing.",
  },
  {
    id: "sip-growth",
    claim: "SIP accounts opened and average monthly SIP inflow growth",
    figure: "~6 crore new SIP accounts; avg. monthly inflow ₹23,743cr → ₹28,766cr",
    asOf: "April 2025 – January 2026",
    sourceName: "NSE data, reported by Business Today",
    sourceUrl:
      "https://www.businesstoday.in/markets/story/nse-trading-accounts-cross-25-crore-unique-investors-at-127-crore-516069-2026-02-13",
  },
  {
    id: "household-ownership",
    claim: "Individual investors' share of NSE-listed company market cap",
    figure: "18.6%, up from 14.6% five years earlier",
    asOf: "31 December 2025",
    sourceName: "NSE data, reported by Business Standard",
    sourceUrl:
      "https://www.business-standard.com/markets/capital-market-news/nse-trading-accounts-cross-25-crore-unique-investors-at-12-7-crore-126021300501_1.html",
    note: "Includes both direct equity holding and indirect holding via mutual funds.",
  },
  {
    id: "five-yr-returns",
    claim: "Nifty 50 / Nifty 500 five-year annualised returns",
    figure: "11.3% / 13.7%",
    asOf: "period ending 11 February 2026",
    sourceName: "NSE data, reported by Business Today",
    sourceUrl:
      "https://www.businesstoday.in/markets/story/nse-trading-accounts-cross-25-crore-unique-investors-at-127-crore-516069-2026-02-13",
    note: "Historical returns over one specific 5-year window — used only to illustrate recency bias, never presented as an expected or future return.",
  },
  {
    id: "fo-losses",
    claim: "Most individual F&O (futures & options) traders lose money",
    figure: "Regulator finding, not a specific percentage cited here",
    asOf: "SEBI has stated this repeatedly in recent years",
    sourceName: "SEBI, referenced via Acumen Group market-data summary",
    sourceUrl: "https://acumengroup.in/how-many-people-invest-in-the-stock-market-in-india/",
    note: "Cited to responsibly counterbalance the participation-growth narrative — growth in accounts is not the same as growth in good outcomes for every participant.",
  },
];

export function getSource(id: string): CampaignSource | undefined {
  return campaignSources.find((s) => s.id === id);
}
