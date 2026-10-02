// Informational capital-gains tax ESTIMATE for QFinera Fund. Pure.
//
//   ESTIMATE - NOT TAX ADVICE
//
// This never touches NAV, units, the ledger, or any member balance. It is a
// reporting aid only and must always be shown with TAX_DISCLAIMER.
//
// Method (stated on every report that shows it):
//   - FIFO lots per instrument (independent of the average-cost holdings
//     view, because holding period needs lot dates).
//   - A gain on a lot held MORE than LONG_TERM_DAYS days is long-term;
//     otherwise short-term.
//   - Buy charges are added to cost; sell charges are deducted from proceeds.
//   - Tax = max(0, net gain of the category) x configured rate. No loss
//     carry-forward, set-off, exemption threshold, surcharge or cess.
//   - Rates come from qfinera_fund_settings.tax_assumptions (configurable).
import { Money } from "./money";
import { daysBetween } from "./nav-cutoff";
import { sortTrades, type ReplayTrade } from "./portfolio";
import { tradeGross } from "./trades";

export const TAX_DISCLAIMER = "ESTIMATE — NOT TAX ADVICE";
export const LONG_TERM_DAYS = 365;

export type TaxAssumptions = {
  /** Percent, e.g. "20". */
  stcgRate: string;
  /** Percent, e.g. "12.5". */
  ltcgRate: string;
};

export type TaxEstimate = {
  disclaimer: typeof TAX_DISCLAIMER;
  stcgGain: Money;
  ltcgGain: Money;
  stcgTax: Money;
  ltcgTax: Money;
  totalEstimatedTax: Money;
};

type Lot = { date: string; qty: Money; cost: Money };

function parseRate(rate: string, label: string): Money {
  const value = Money.fromDecimalString(rate);
  if (value.isNegative() || value.compare(Money.fromDecimalString("100")) > 0) {
    throw new Error(`${label} must be between 0 and 100`);
  }
  return value;
}

function taxOn(gain: Money, rate: Money): Money {
  if (gain.compare(Money.zero()) <= 0) return Money.zero();
  return gain.multiply(rate).divide(Money.fromDecimalString("100")).round(2);
}

export function estimateTax(
  trades: readonly ReplayTrade[],
  assumptions: TaxAssumptions,
  window?: { from: string; to: string }
): TaxEstimate {
  const stcgRate = parseRate(assumptions.stcgRate, "short-term rate");
  const ltcgRate = parseRate(assumptions.ltcgRate, "long-term rate");

  const books = new Map<number, Lot[]>();
  let stcgGain = Money.zero();
  let ltcgGain = Money.zero();

  for (const t of sortTrades(trades)) {
    const book = books.get(t.instrumentId) ?? [];
    books.set(t.instrumentId, book);

    if (t.side === "BUY") {
      book.push({ date: t.tradeDate, qty: t.quantity, cost: tradeGross(t.quantity, t.price).add(t.charges) });
      continue;
    }

    const proceeds = tradeGross(t.quantity, t.price).subtract(t.charges);
    let remaining = t.quantity;
    let proceedsLeft = proceeds;

    while (!remaining.isZero()) {
      const lot = book[0];
      if (!lot) throw new Error("tax estimate: sell exceeds buys (oversell in trade history)");

      const take = lot.qty.compare(remaining) <= 0 ? lot.qty : remaining;
      const finalSlice = take.equals(remaining);
      const costPart = take.equals(lot.qty) ? lot.cost : lot.cost.multiply(take).divide(lot.qty).round(2);
      const proceedsPart = finalSlice ? proceedsLeft : proceeds.multiply(take).divide(t.quantity).round(2);

      proceedsLeft = proceedsLeft.subtract(proceedsPart);
      lot.qty = lot.qty.subtract(take);
      lot.cost = lot.cost.subtract(costPart);
      remaining = remaining.subtract(take);
      const lotDate = lot.date;
      if (lot.qty.isZero()) book.shift();

      const inWindow = !window || (t.tradeDate >= window.from && t.tradeDate <= window.to);
      if (inWindow) {
        const gain = proceedsPart.subtract(costPart);
        if (daysBetween(lotDate, t.tradeDate) > LONG_TERM_DAYS) ltcgGain = ltcgGain.add(gain);
        else stcgGain = stcgGain.add(gain);
      }
    }
  }

  const stcgTax = taxOn(stcgGain, stcgRate);
  const ltcgTax = taxOn(ltcgGain, ltcgRate);
  return {
    disclaimer: TAX_DISCLAIMER,
    stcgGain,
    ltcgGain,
    stcgTax,
    ltcgTax,
    totalEstimatedTax: stcgTax.add(ltcgTax),
  };
}
