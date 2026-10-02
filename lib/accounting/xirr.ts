// Informational XIRR for a member's cash flows. NOT authoritative:
// it never affects NAV, units, or the ledger.
//
// Flow signs: contributions are NEGATIVE, withdrawals POSITIVE, and the
// member's current value is a POSITIVE terminal flow on the valuation date.
//
// This is the only accounting module that converts Money to a JavaScript
// number: XIRR is an iterative, informational estimate, so floating point
// is acceptable here and nowhere else. Returns null ("N/A") whenever a
// single, valid annual rate cannot be established:
//   - no negative flow or no positive flow
//   - all flows on the same day
//   - an invalid date
//   - no root, or more than one root, in the searched range (-99% .. +100000%)
import { Money } from "./money";

export type DatedCashFlow = {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  amount: Money;
};

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365;

// Coarse grid used to bracket roots before bisection.
const RATE_GRID = [
  -0.99, -0.95, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2, 0.3,
  0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 25, 100, 1000,
];

function toDayNumber(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== iso) return null;
  return ms / MS_PER_DAY;
}

type Term = { t: number; a: number };

function npv(rate: number, terms: readonly Term[]): number {
  let sum = 0;
  for (const term of terms) sum += term.a / Math.pow(1 + rate, term.t);
  return sum;
}

function bisect(lo: number, hi: number, terms: readonly Term[]): number {
  let flo = npv(lo, terms);
  for (let i = 0; i < 200 && hi - lo > 1e-12; i++) {
    const mid = (lo + hi) / 2;
    const fmid = npv(mid, terms);
    if (flo * fmid <= 0) {
      hi = mid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}

export function xirr(flows: readonly DatedCashFlow[]): number | null {
  const dated: Array<{ day: number; a: number }> = [];
  for (const flow of flows) {
    const day = toDayNumber(flow.date);
    if (day === null) return null;
    const a = Number(flow.amount.toDecimalString(2));
    if (a !== 0) dated.push({ day, a });
  }

  if (!dated.some((d) => d.a < 0) || !dated.some((d) => d.a > 0)) return null;

  const firstDay = Math.min(...dated.map((d) => d.day));
  const terms: Term[] = dated.map((d) => ({ t: (d.day - firstDay) / DAYS_PER_YEAR, a: d.a }));
  if (terms.every((term) => term.t === 0)) return null;

  const roots: number[] = [];
  const values = RATE_GRID.map((r) => npv(r, terms));

  for (let i = 0; i < RATE_GRID.length; i++) {
    const a = values[i];
    if (!Number.isFinite(a)) continue;
    if (a === 0) {
      roots.push(RATE_GRID[i]);
      continue;
    }
    if (i + 1 < RATE_GRID.length) {
      const b = values[i + 1];
      if (Number.isFinite(b) && a * b < 0) {
        roots.push(bisect(RATE_GRID[i], RATE_GRID[i + 1], terms));
      }
    }
  }

  if (roots.length !== 1) return null;
  return Number.isFinite(roots[0]) ? roots[0] : null;
}
