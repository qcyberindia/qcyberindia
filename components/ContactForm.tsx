"use client";

import { useState, FormEvent } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export default function ContactForm() {
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
      company: String(data.get("company") || ""),
      message: String(data.get("message") || ""),
      website: String(data.get("website") || ""), // honeypot
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setStatus("error");
        setErrorMsg(json.error || "Something went wrong. Try again.");
        return;
      }

      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg border border-[var(--color-gold)]/40 bg-[#ffffff] p-6">
        <p className="font-mono text-sm text-[var(--color-gold)]">MESSAGE SENT</p>
        <p className="mt-2 text-[var(--color-navy)]">
          Thanks for reaching out — we typically reply within one business day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot field, hidden from real users */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        aria-hidden="true"
      />

      <div>
        <label htmlFor="name" className="block font-mono text-xs text-[var(--color-fog)] mb-1.5">
          NAME
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full rounded-md border border-[var(--color-line)] bg-[#ffffff] px-3.5 py-2.5 text-[var(--color-navy)] outline-none focus:border-[var(--color-red)]"
        />
      </div>

      <div>
        <label htmlFor="email" className="block font-mono text-xs text-[var(--color-fog)] mb-1.5">
          EMAIL
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-md border border-[var(--color-line)] bg-[#ffffff] px-3.5 py-2.5 text-[var(--color-navy)] outline-none focus:border-[var(--color-red)]"
        />
      </div>

      <div>
        <label htmlFor="company" className="block font-mono text-xs text-[var(--color-fog)] mb-1.5">
          COMPANY <span className="text-[var(--color-fog)]/60">(optional)</span>
        </label>
        <input
          id="company"
          name="company"
          type="text"
          className="w-full rounded-md border border-[var(--color-line)] bg-[#ffffff] px-3.5 py-2.5 text-[var(--color-navy)] outline-none focus:border-[var(--color-red)]"
        />
      </div>

      <div>
        <label htmlFor="message" className="block font-mono text-xs text-[var(--color-fog)] mb-1.5">
          MESSAGE
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="w-full rounded-md border border-[var(--color-line)] bg-[#ffffff] px-3.5 py-2.5 text-[var(--color-navy)] outline-none focus:border-[var(--color-red)]"
        />
      </div>

      {status === "error" && (
        <p className="font-mono text-sm text-[#dc2626]">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center rounded-md bg-[var(--color-red)] px-5 py-3 text-sm font-medium text-[#ffffff] hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {status === "submitting" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
