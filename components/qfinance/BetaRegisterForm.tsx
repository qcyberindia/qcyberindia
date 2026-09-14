"use client";

import { useState, FormEvent } from "react";

type Status = "idle" | "submitting" | "success" | "duplicate" | "error";

const inputBase =
  "w-full rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3.5 py-2.5 font-body text-[var(--qf-ink)] outline-none transition-colors placeholder:text-[var(--qf-ink-soft)]/60 focus:border-[var(--qf-brass)] focus:ring-2 focus:ring-[var(--qf-brass)]/15";

export default function BetaRegisterForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      website: String(data.get("website") || ""), // honeypot
    };

    try {
      const res = await fetch("/api/qfinance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setErrorMsg(json.error || "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setStatus(json.duplicate ? "duplicate" : "success");
      form.reset();
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success" || status === "duplicate") {
    return (
      <div className="rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-8 text-center">
        <p className="font-display text-lg font-semibold text-[var(--qf-ink)]">
          {status === "duplicate" ? "You're already on the list" : "You're on the list"}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--qf-ink-soft)]">
          {status === "duplicate"
            ? "This email is already registered — no need to sign up again."
            : "We'll email you when QFinera beta access opens. In the meantime, the Beginner Journey is already live and free."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5 rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-6 sm:p-8"
    >
      {/* Honeypot — hidden from real users via CSS, bots fill every field */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="qf-website">Website</label>
        <input type="text" id="qf-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="qf-name" className="text-xs font-medium uppercase tracking-wide text-[var(--qf-ink-soft)]">
          Name
        </label>
        <input id="qf-name" name="name" type="text" required className={inputBase} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="qf-email" className="text-xs font-medium uppercase tracking-wide text-[var(--qf-ink-soft)]">
          Email
        </label>
        <input id="qf-email" name="email" type="email" required className={inputBase} />
      </div>

      {status === "error" && (
        <p className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3 py-2 text-sm text-[var(--qf-down)]">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-md bg-[var(--qf-brass-dark)] px-4 py-3 font-display text-sm font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {status === "submitting" ? "Joining…" : "Join the Beta"}
      </button>

      <p className="text-xs text-[var(--qf-ink-soft)]">
        We&apos;ll only use this to contact you about QFinera beta access. No spam.
      </p>
    </form>
  );
}
