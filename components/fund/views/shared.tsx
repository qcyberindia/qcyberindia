"use client";

// Small pieces shared by several pool views.
import { useState } from "react";
import { apiFetch, poolApi, type InstrumentDto } from "@/components/fund/api";
import { FormField, inputClass } from "@/components/fund/forms";
import { groupIndian } from "@/components/fund/format";
import { useFund } from "@/components/fund/session";

/** Side is spelled out (Buy/Sell); colour only reinforces it. */
export function SideLabel({ side }: { side: string }) {
  return <span className={`font-semibold ${side === "BUY" ? "text-[var(--qf-fix)]" : "text-[var(--qf-down)]"}`}>{side === "BUY" ? "Buy" : "Sell"}</span>;
}

/** Today's date in IST as YYYY-MM-DD (default for date inputs only; the server validates). */
export function todayIstInput(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "2026-11-26" -> "26-NOV-2026" (exchange contract style). */
export function contractDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
}

/** "25000.0000" -> "25,000"; "2512.5000" -> "2,512.5" (display only). */
export function strikeLabel(strike: string | null | undefined): string {
  if (!strike) return "";
  const [whole, frac = ""] = strike.split(".");
  const f = frac.replace(/0+$/, "");
  return `${groupIndian(whole)}${f ? `.${f}` : ""}`;
}

type InstrumentLike = {
  symbol: string;
  exchange: string;
  instrumentType?: string | null;
  underlying?: string | null;
  expiryDate?: string | null;
  strikePrice?: string | null;
  optionType?: string | null;
};

/** One-line instrument label: "INFY", "NIFTY 26-NOV-2026 FUT", "NIFTY 26-NOV-2026 25,000 CE". */
export function instrumentLabel(i: InstrumentLike): string {
  if (i.instrumentType === "FUTURE") return `${i.underlying} ${contractDate(i.expiryDate)} FUT`;
  if (i.instrumentType === "OPTION") return `${i.underlying} ${contractDate(i.expiryDate)} ${strikeLabel(i.strikePrice)} ${i.optionType}`;
  return i.symbol;
}

/** Instrument with its contract details laid out (underlying / expiry / strike type / exchange). */
export function InstrumentSummary({ i, name }: { i: InstrumentLike; name?: string | null }) {
  if (i.instrumentType === "FUTURE" || i.instrumentType === "OPTION") {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-2">
        <strong>{i.underlying}</strong>
        <span>{contractDate(i.expiryDate)}</span>
        <span className="font-semibold">{i.instrumentType === "FUTURE" ? "FUT" : `${strikeLabel(i.strikePrice)} ${i.optionType}`}</span>
        <span className="text-[var(--qf-ink-soft)]">{i.exchange}</span>
      </span>
    );
  }
  return (
    <span>
      <strong>{i.symbol}</strong> &middot; {i.exchange}
      {name ? <span className="text-[var(--qf-ink-soft)]"> &middot; {name}</span> : null}
    </span>
  );
}

export const PRODUCT_LABEL: Record<string, string> = {
  EQUITY_DELIVERY: "Equity · Delivery",
  EQUITY_INTRADAY: "Equity · Intraday",
  FUTURES: "Futures",
  OPTIONS: "Options",
};

export const ACTION_LABEL: Record<string, string> = {
  OPEN_LONG: "Open long",
  OPEN_SHORT: "Open short",
  CLOSE_LONG: "Close long",
  CLOSE_SHORT: "Close short",
};

/** LONG / SHORT, spelled out; colour only reinforces it. */
export function DirectionLabel({ direction }: { direction: string | null }) {
  if (!direction) return <span className="text-[var(--qf-ink-soft)]">Closed</span>;
  return <span className={`font-semibold ${direction === "LONG" ? "text-[var(--qf-fix)]" : "text-[var(--qf-down)]"}`}>{direction === "LONG" ? "Long" : "Short"}</span>;
}

export type InstrumentKind = "EQUITY" | "FUTURE" | "OPTION";

const PICKER_HINT: Record<InstrumentKind, string> = {
  EQUITY: "Search by NSE/BSE symbol, company name or ISIN.",
  FUTURE: "Search by underlying (e.g. NIFTY); narrow by expiry.",
  OPTION: "Search by underlying; narrow by expiry, strike and CE/PE.",
};

/**
 * Instrument search-and-pick, limited to one instrument kind so an equity
 * row can never be picked for a derivative ticket (or the reverse).
 * Searches on submit (button or Enter), so typing does not fire a request
 * per keystroke.
 */
export function InstrumentPicker({
  value,
  onChange,
  error,
  kind = "EQUITY",
  required = true,
  label: labelOverride,
}: {
  value: InstrumentDto | null;
  onChange: (i: InstrumentDto | null) => void;
  error?: string | null;
  kind?: InstrumentKind;
  /** False for filters. */
  required?: boolean;
  label?: string;
}) {
  const { poolId } = useFund();
  const [q, setQ] = useState("");
  const [expiry, setExpiry] = useState("");
  const [strike, setStrike] = useState("");
  const [optionType, setOptionType] = useState("");
  const [results, setResults] = useState<InstrumentDto[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const label = labelOverride ?? (kind === "EQUITY" ? "Instrument" : "Contract");

  async function search() {
    setSearching(true);
    setFailed(null);
    try {
      const { instruments } = await apiFetch<{ instruments: InstrumentDto[] }>(poolApi(poolId, "instruments"), {
        query: {
          q: q.trim(),
          type: kind,
          expiry: kind !== "EQUITY" ? expiry || null : null,
          strike: kind === "OPTION" ? strike.trim() || null : null,
          optionType: kind === "OPTION" ? optionType || null : null,
        },
      });
      setResults(instruments);
    } catch {
      setFailed("Search failed. Check the filters and try again.");
    } finally {
      setSearching(false);
    }
  }

  if (value) {
    return (
      <FormField label={label} required={required || undefined}>
        {(p) => (
          <div id={p.id} className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-[var(--qf-line)] px-3 py-2 text-[14px]">
            <InstrumentSummary i={value} name={value.name} />
            <button type="button" className="min-h-8 shrink-0 text-[13px] text-[var(--qf-brass-dark)] underline" onClick={() => onChange(null)}>
              {required ? "Change" : "Clear"}
            </button>
          </div>
        )}
      </FormField>
    );
  }

  return (
    <FormField label={label} required={required || undefined} error={error ?? failed} hint={required ? PICKER_HINT[kind] : undefined}>
      {(p) => (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              {...p}
              type="search"
              value={q}
              maxLength={60}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
              className={inputClass}
              placeholder={kind === "EQUITY" ? "e.g. INFY" : "e.g. NIFTY"}
            />
            <button type="button" onClick={() => void search()} disabled={searching} className="min-h-10 shrink-0 rounded-md border border-[var(--qf-line)] px-3 text-[13px] font-semibold hover:border-[var(--qf-brass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]">
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
          {kind !== "EQUITY" && (
            <div className="grid gap-2 sm:grid-cols-3">
              <input type="date" aria-label="Expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inputClass} />
              {kind === "OPTION" && (
                <>
                  <input type="text" inputMode="decimal" aria-label="Strike" placeholder="Strike" value={strike} onChange={(e) => setStrike(e.target.value)} className={inputClass} />
                  <select aria-label="Option type" value={optionType} onChange={(e) => setOptionType(e.target.value)} className={inputClass}>
                    <option value="">CE or PE</option>
                    <option value="CE">CE (call)</option>
                    <option value="PE">PE (put)</option>
                  </select>
                </>
              )}
            </div>
          )}
          {results && (
            <ul className="max-h-48 overflow-y-auto rounded-md border border-[var(--qf-line)]" aria-label="Search results">
              {results.length === 0 ? (
                <li className="px-3 py-2 text-[13px] text-[var(--qf-ink-soft)]">
                  No match. A manager can add the {kind === "EQUITY" ? "instrument" : "contract"} from the Positions page.
                </li>
              ) : (
                results.map((i) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => onChange(i)} className="block w-full px-3 py-2 text-left text-[13.5px] hover:bg-[var(--qf-cream-1)]">
                      <InstrumentSummary i={i} name={i.name} />
                      {i.series && i.series !== "EQ" ? <span className="text-[var(--qf-ink-soft)]"> &middot; {i.series}</span> : null}
                      {i.lotSize && kind !== "EQUITY" ? <span className="text-[var(--qf-ink-soft)]"> &middot; lot {i.lotSize}</span> : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}
    </FormField>
  );
}
