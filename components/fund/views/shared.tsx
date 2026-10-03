"use client";

// Small pieces shared by several pool views.
import { useState } from "react";
import { apiFetch, poolApi, type InstrumentDto } from "@/components/fund/api";
import { FormField, inputClass } from "@/components/fund/forms";
import { useFund } from "@/components/fund/session";

/** Side is spelled out (Buy/Sell); colour only reinforces it. */
export function SideLabel({ side }: { side: string }) {
  return <span className={`font-semibold ${side === "BUY" ? "text-[var(--qf-fix)]" : "text-[var(--qf-down)]"}`}>{side === "BUY" ? "Buy" : "Sell"}</span>;
}

/** Today's date in IST as YYYY-MM-DD (default for date inputs only; the server validates). */
export function todayIstInput(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/**
 * Instrument search-and-pick. Searches on submit (button or Enter), so typing
 * does not fire a request per keystroke.
 */
export function InstrumentPicker({
  value,
  onChange,
  error,
}: {
  value: InstrumentDto | null;
  onChange: (i: InstrumentDto | null) => void;
  error?: string | null;
}) {
  const { poolId } = useFund();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<InstrumentDto[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function search() {
    setSearching(true);
    setFailed(null);
    try {
      const { instruments } = await apiFetch<{ instruments: InstrumentDto[] }>(poolApi(poolId, "instruments"), { query: { q: q.trim() } });
      setResults(instruments);
    } catch {
      setFailed("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  }

  if (value) {
    return (
      <FormField label="Instrument" required>
        {(p) => (
          <div id={p.id} className="flex items-center justify-between gap-3 rounded-md border border-[var(--qf-line)] px-3 py-2 text-[14px]">
            <span>
              <strong>{value.symbol}</strong> &middot; {value.exchange}
              {value.name ? <span className="text-[var(--qf-ink-soft)]"> &middot; {value.name}</span> : null}
            </span>
            <button type="button" className="text-[13px] text-[var(--qf-brass-dark)] underline" onClick={() => onChange(null)}>
              Change
            </button>
          </div>
        )}
      </FormField>
    );
  }

  return (
    <FormField label="Instrument" required error={error ?? failed} hint="Search by NSE/BSE symbol, company name or ISIN.">
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
              placeholder="e.g. INFY"
            />
            <button type="button" onClick={() => void search()} disabled={searching} className="rounded-md border border-[var(--qf-line)] px-3 text-[13px] font-semibold">
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
          {results && (
            <ul className="max-h-48 overflow-y-auto rounded-md border border-[var(--qf-line)]" aria-label="Search results">
              {results.length === 0 ? (
                <li className="px-3 py-2 text-[13px] text-[var(--qf-ink-soft)]">No match. A manager can add the instrument from the Holdings page.</li>
              ) : (
                results.map((i) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => onChange(i)} className="block w-full px-3 py-2 text-left text-[13.5px] hover:bg-[var(--qf-cream-1)]">
                      <strong>{i.symbol}</strong> &middot; {i.exchange}
                      {i.series && i.series !== "EQ" ? <span className="text-[var(--qf-ink-soft)]"> &middot; {i.series}</span> : null}
                      {i.name ? <span className="text-[var(--qf-ink-soft)]"> &middot; {i.name}</span> : null}
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
