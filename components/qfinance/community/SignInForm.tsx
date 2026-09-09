"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";

const inputClass =
  "w-full rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3.5 py-2.5 text-[15px] text-[var(--qf-ink)] outline-none transition-colors focus:border-[var(--qf-brass)]";

/** Passwordless sign-in: email + display name → magic link email. Used
 * anywhere the Community needs identity (asking a question, replying,
 * reporting) before the action can proceed. */
export default function SignInForm({ prompt = "Sign in to continue" }: { prompt?: string }) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    try {
      const res = await fetch("/api/qfinance/community/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="flex items-start gap-2.5 rounded-md border border-[var(--qf-up)]/30 bg-[var(--qf-up)]/10 p-4">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--qf-up)]" />
        <div>
          <p className="text-[14.5px] font-medium text-[var(--qf-ink)]">Check your email</p>
          <p className="mt-1 text-[13.5px] text-[var(--qf-ink-soft)]">
            We sent a sign-in link to {email}. It expires in 15 minutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-4">
      <p className="text-[14px] font-medium text-[var(--qf-ink)]">{prompt}</p>
      <p className="mt-1 text-[13px] text-[var(--qf-ink-soft)]">
        No password — we&apos;ll email you a one-click sign-in link.
      </p>

      <div className="mt-3 space-y-2.5">
        <input
          type="text"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          required
          className={inputClass}
        />
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />
      </div>

      {error && <p className="mt-2 text-[13px] text-[var(--qf-down)]">{error}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--qf-brass)] px-4 py-2 text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {status === "submitting" ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
        {status === "submitting" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
