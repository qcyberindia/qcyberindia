"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import { CommunityAuthProvider, useCommunityAuth } from "./CommunityAuthContext";
import SignInForm from "./SignInForm";

const CATEGORIES = [
  "Getting Started",
  "Stocks",
  "Mutual Funds & ETFs",
  "Markets",
  "Risk & Safety",
  "Costs & Taxes",
  "Apps & Accounts",
  "General",
] as const;

// Mirrors lib/db.ts's suggestQFinanceCategory — kept as a small client-side
// copy rather than importing server code into a "use client" component.
// Deterministic keyword heuristic, no AI service, never blocks posting.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Stocks: ["stock", "share", "shares", "equity", "ipo", "dividend"],
  "Mutual Funds & ETFs": ["mutual fund", "mf", "etf", "sip", "nav", "index fund"],
  Markets: ["nifty", "sensex", "market", "index", "bull", "bear", "crash", "rally", "correction"],
  "Risk & Safety": ["scam", "fraud", "safe", "risk", "guarantee", "loss", "lose everything"],
  "Costs & Taxes": ["tax", "brokerage", "charges", "fee", "stt", "gst", "capital gains"],
  "Apps & Accounts": ["demat", "broker", "app", "account", "kyc", "kite", "groww", "zerodha"],
  "Getting Started": ["beginner", "start", "new to", "how do i begin", "first time"],
};

function suggestCategory(question: string): (typeof CATEGORIES)[number] {
  const q = question.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => q.includes(kw))) return category as (typeof CATEGORIES)[number];
  }
  return "General";
}

/** Auto-expanding textarea — grows with content up to a max, no manual
 * resize handle. Shared sizing logic for both the question and context
 * fields so they feel like one connected voice, not a form. */
function AutoTextarea({
  value,
  onChange,
  placeholder,
  minRows = 2,
  maxRows = 10,
  maxLength,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  minRows?: number;
  maxRows?: number;
  maxLength?: number;
  autoFocus?: boolean;
  className: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 24; // matches the ~15.5px/1.55 body text used below
    const maxHeight = lineHeight * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, maxRows]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      autoFocus={autoFocus}
      rows={minRows}
      className={className}
    />
  );
}

const fieldClass =
  "w-full resize-none rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3.5 py-2.5 text-[15.5px] leading-[1.55] text-[var(--qf-ink)] outline-none transition-colors duration-200 placeholder:text-[var(--qf-ink-soft)]/60 focus:border-[var(--qf-brass)] focus:ring-2 focus:ring-[var(--qf-brass)]/15";

function ComposerForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  // Only the user's manual choice lives in state. The automatic suggestion
  // is derived, not stored, so there's nothing to synchronize via an
  // effect — it just recomputes on every render from the current question,
  // the same way any other derived value would (see
  // https://react.dev/learn/you-might-not-need-an-effect).
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [error, setError] = useState("");

  // Derived, not stateful: recalculates from `question` on every render.
  // Cheap (a handful of `.includes()` checks), so useMemo here is purely to
  // avoid recomputing on renders the question didn't change, not because
  // the computation is expensive.
  const suggestedCategory = useMemo(() => suggestCategory(question), [question]);

  // What actually gets shown as selected and submitted: the user's manual
  // pick if they've made one, otherwise the live suggestion. Once they've
  // touched a pill, further typing can no longer silently move their
  // selection out from under them.
  const effectiveCategory = selectedCategory ?? suggestedCategory;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || status === "submitting") return;
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/qfinance/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: question, category: effectiveCategory, body: context }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
      // Land directly on the new thread — never a generic community homepage.
      router.push(`/qfinera/community/${json.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5">
      <p className="font-display text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--qf-brass-dark)]">
        Ask something
      </p>
      <p className="mt-1 font-display text-lg font-semibold text-[var(--qf-ink)]">What are you curious about?</p>

      <div className="mt-4">
        <AutoTextarea
          value={question}
          onChange={setQuestion}
          placeholder="Why has Nifty 50 fallen so much when many companies are doing better than FY25?"
          minRows={3}
          maxRows={8}
          maxLength={150}
          autoFocus
          className={`${fieldClass} font-medium`}
        />
      </div>

      {/* Category — a suggestion the person can change, not a decision
          they have to make before they understand whether it matters. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const selected = c === effectiveCategory;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCategory(c)}
              aria-pressed={selected}
              className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-all duration-150 active:scale-95 ${
                selected
                  ? "border-[var(--qf-brass)] bg-[var(--qf-brass)]/12 text-[var(--qf-brass-dark)]"
                  : "border-[var(--qf-line)] text-[var(--qf-ink-soft)] hover:border-[var(--qf-brass)]/50"
              }`}
            >
              {c}
              {selected && <Check size={11} className="ml-1 inline -mt-0.5" />}
            </button>
          );
        })}
      </div>

      {/* Context — optional, collapsed by default so the question stays
          the star of the form. */}
      {showContext ? (
        <div className="mt-3">
          <AutoTextarea
            value={context}
            onChange={setContext}
            placeholder="Add context if you want... research you've already done, links, what you're trying to figure out."
            minRows={2}
            maxRows={10}
            maxLength={4000}
            className={fieldClass}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowContext(true)}
          className="mt-3 text-[13px] font-medium text-[var(--qf-ink-soft)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--qf-brass-dark)]"
        >
          Add context if you want…
        </button>
      )}

      {status === "error" && <p className="mt-3 text-[13px] text-[var(--qf-down)]">{error}</p>}

      <div className="mt-4 flex items-center gap-2.5">
        <button
          type="submit"
          disabled={!question.trim() || status === "submitting"}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--qf-brass)] px-4 py-2 text-sm font-semibold text-[var(--qf-cream-0)] transition-all duration-150 hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "submitting" && <Loader2 size={14} className="animate-spin" />}
          {status === "submitting" ? "Posting…" : "Post question"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-[var(--qf-ink-soft)] transition-colors hover:text-[var(--qf-ink)]"
        >
          Cancel
        </button>
      </div>

      <p className="mt-3 text-[12px] text-[var(--qf-ink-soft)]">
        Never share your OTP, password, PAN, Aadhaar, bank details, or broker credentials here.
      </p>
    </form>
  );
}

function AskQuestionInner() {
  const { user, checking } = useCommunityAuth();
  const [open, setOpen] = useState(false);

  if (checking) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--qf-brass)] px-5 py-2.5 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-all duration-150 hover:opacity-90 active:scale-95"
      >
        Ask a question
      </button>
    );
  }

  if (!user) {
    return (
      <div className="max-w-sm">
        <SignInForm prompt="Sign in to post your own question" />
        <button type="button" onClick={() => setOpen(false)} className="mt-2 text-sm text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]">
          Cancel
        </button>
      </div>
    );
  }

  return <ComposerForm onClose={() => setOpen(false)} />;
}

export default function AskQuestionButton() {
  return (
    <CommunityAuthProvider>
      <AskQuestionInner />
    </CommunityAuthProvider>
  );
}
