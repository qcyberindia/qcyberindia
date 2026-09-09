"use client";

import { useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";

type Side = "buy" | "sell";
type Stage = "idle" | "placed" | "sent" | "matched" | "settled";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  placed: "Order placed",
  sent: "Sent to your broker",
  matched: "Matched on the exchange with another investor",
  settled: "Shares updated in your Demat account",
};

const STAGE_ORDER: Stage[] = ["placed", "sent", "matched", "settled"];

type LedgerEntry = {
  id: number;
  side: Side;
  qty: number;
  price: number;
};

/**
 * The smallest practical "place an order" simulation — no existing
 * order-book/ledger/SIP component was found in the repository to reuse
 * (see qfinance.md Session 14), so this was purpose-built rather than
 * duplicating something that didn't actually exist. Plain React state +
 * setTimeout + CSS transitions only — no SketchFlow, no animation library.
 */
export default function OrderSimulator() {
  const [side, setSide] = useState<Side>("buy");
  const [qty, setQty] = useState(5);
  const [stage, setStage] = useState<Stage>("idle");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [nextId, setNextId] = useState(1);

  function placeOrder() {
    if (stage !== "idle") return;
    setStage("placed");

    const price = 240 + Math.round((Math.random() - 0.5) * 20); // illustrative only

    setTimeout(() => setStage("sent"), 500);
    setTimeout(() => setStage("matched"), 1100);
    setTimeout(() => {
      setStage("settled");
      setLedger((prev) => [{ id: nextId, side, qty, price }, ...prev].slice(0, 5));
      setNextId((n) => n + 1);
    }, 1700);
  }

  function reset() {
    setStage("idle");
  }

  const currentIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 sm:p-6">
      <p className="inline-flex items-center gap-1.5 rounded-full border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/10 px-3 py-1 text-[11.5px] font-semibold text-[var(--qf-brass-dark)]">
        Educational simulation — no real money is involved
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <span id="order-side-label" className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
            Side
          </span>
          <div role="group" aria-labelledby="order-side-label" className="flex overflow-hidden rounded-md border border-[var(--qf-line)]">
            {(["buy", "sell"] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={stage !== "idle"}
                aria-pressed={side === s}
                onClick={() => setSide(s)}
                className={`px-4 py-2 text-sm font-semibold capitalize transition-colors disabled:cursor-not-allowed ${
                  side === s
                    ? "bg-[var(--qf-brass-dark)] text-[var(--qf-cream-0)]"
                    : "bg-[var(--qf-cream-0)] text-[var(--qf-ink-soft)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="qty" className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
            Quantity (shares)
          </label>
          <input
            id="qty"
            type="number"
            min={1}
            max={100}
            value={qty}
            disabled={stage !== "idle"}
            onChange={(e) => setQty(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
            className="w-24 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3 py-2 text-sm text-[var(--qf-ink)] outline-none focus:border-[var(--qf-brass)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>

        {stage === "idle" ? (
          <button
            type="button"
            onClick={placeOrder}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--qf-brass-dark)] px-5 py-2.5 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90"
          >
            Place {side} order
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={reset}
            disabled={stage !== "settled"}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--qf-line)] px-5 py-2.5 font-display text-sm font-semibold text-[var(--qf-ink)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RotateCcw size={14} />
            Try another
          </button>
        )}
      </div>

      {stage !== "idle" && (
        <div className="mt-6 space-y-2.5">
          {STAGE_ORDER.map((s, i) => (
            <div
              key={s}
              className="flex items-center gap-3 transition-opacity duration-300"
              style={{ opacity: i <= currentIndex ? 1 : 0.3 }}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  i <= currentIndex ? "bg-[var(--qf-brass)]" : "bg-[var(--qf-line)]"
                }`}
              />
              <span className="text-[13.5px] text-[var(--qf-ink)]">{STAGE_LABEL[s]}</span>
            </div>
          ))}
        </div>
      )}

      {ledger.length > 0 && (
        <div className="mt-6 border-t border-[var(--qf-line)] pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
            Your simulated orders
          </p>
          <ul className="mt-2.5 space-y-1.5">
            {ledger.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between text-[13.5px] text-[var(--qf-ink)]">
                <span className="capitalize">
                  {entry.side} {entry.qty} shares
                </span>
                <span className="text-[var(--qf-ink-soft)]">
                  at ~₹{entry.price} <span className="italic">(simulated price)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
