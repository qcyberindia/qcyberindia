"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";

const inputClass =
  "w-full rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3.5 py-2.5 text-[15px] text-[var(--qf-ink)] outline-none transition-colors placeholder:text-[var(--qf-ink-soft)]/60 focus:border-[var(--qf-brass)] focus:ring-2 focus:ring-[var(--qf-brass)]/15";

const labelClass = "text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]";

/** Passwordless sign-in: email + display name → magic link email. Used
 * anywhere the Community needs identity (asking a question, replying,
 * reporting) before the action can proceed. Same functionality/endpoint as
 * before — this pass is presentation only, to feel like a deliberate
 * QFinera product component rather than a generic login form. */
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
      <div className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--qf-up)]/15">
            <CheckCircle2 size={17} className="text-[var(--qf-up)]" />
          </span>
          <div>
            <p className="font-display text-[15px] font-semibold text-[var(--qf-ink)]">Check your email</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              We sent a secure sign-in link to <strong className="text-[var(--qf-ink)]">{email}</strong>.
              It expires in 15 minutes and can only be used once.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 sm:p-6">
      <p className="font-display text-lg font-semibold text-[var(--qf-ink)]">Join the QFinera Community</p>
      <p className="mt-1 text-[13.5px] text-[var(--qf-ink-soft)]">{prompt}</p>

      <div className="mt-4 flex items-start gap-2.5 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-3.5">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[var(--qf-brass)]" />
        <p className="text-[12.5px] leading-relaxed text-[var(--qf-ink-soft)]">
          Sign in with your email. No password to remember — we&apos;ll send a secure one-time link
          instead. Your email stays private; only your display name appears in the community.
        </p>
      </div>

      <div className="mt-4 space-y-3.5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="qf-signin-name" className={labelClass}>
            Display name
          </label>
          <input
            id="qf-signin-name"
            type="text"
            placeholder="A nickname is fine"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="qf-signin-email" className={labelClass}>
            Email
          </label>
          <input
            id="qf-signin-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-[13px] text-[var(--qf-down)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--qf-brass-dark)] px-4 py-2.5 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {status === "submitting" && <Loader2 size={14} className="animate-spin" />}
        {status === "submitting" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
