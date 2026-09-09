"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
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

const inputClass =
  "w-full rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3.5 py-2.5 text-[15px] text-[var(--qf-ink)] outline-none transition-colors focus:border-[var(--qf-brass)]";

function ComposerForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/qfinance/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, body }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      router.push(`/qfinance/community/${json.id}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5">
      <div className="flex items-start justify-between">
        <p className="font-display text-lg font-semibold text-[var(--qf-ink)]">Ask a question</p>
        <button type="button" onClick={onClose} aria-label="Cancel" className="text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]">
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <input
          type="text"
          placeholder="What happens to my shares if my broker shuts down?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={150}
          required
          className={inputClass}
        />

        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <textarea
          placeholder="Add any context that would help someone answer well…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          required
          rows={5}
          className={`${inputClass} resize-y`}
        />
      </div>

      <p className="mt-3 text-[12.5px] text-[var(--qf-ink-soft)]">
        Never share your OTP, password, PAN, Aadhaar, bank details, or broker credentials here.
      </p>

      {error && <p className="mt-2 text-[13px] text-[var(--qf-down)]">{error}</p>}

      <div className="mt-4 flex items-center gap-2.5">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--qf-brass)] px-4 py-2 text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? "Posting…" : "Post"}
        </button>
        <button type="button" onClick={onClose} className="text-sm font-medium text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)]">
          Cancel
        </button>
      </div>
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
        className="inline-flex items-center gap-1.5 rounded-full bg-[var(--qf-brass)] px-5 py-2.5 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90"
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
