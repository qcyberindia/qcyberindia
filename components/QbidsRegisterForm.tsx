"use client";

import { useState, FormEvent } from "react";
import { CheckCircle2, Copy, Loader2 } from "lucide-react";

type Status = "idle" | "submitting" | "success" | "duplicate" | "error";

const PORTALS = ["GeM", "CPPP", "State e-Procurement", "Other"];

const inputBase =
  "w-full rounded-md border border-[#1e2a38] bg-[#0c1016] px-3.5 py-2.5 text-[#e6edf3] placeholder:text-[#8aa0b4]/60 outline-none transition-colors focus:border-[#3fd0c9] focus:ring-2 focus:ring-[#3fd0c9]/15";

const nextSteps = [
  { label: "Registration", done: true },
  { label: "Review", done: false },
  { label: "Beta invitation", done: false },
  { label: "Qbids access", done: false },
];

export default function QbidsRegisterForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [portals, setPortals] = useState<string[]>([]);

  function togglePortal(p: string) {
    setPortals((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const payload = {
      name: String(data.get("name") || ""),
      company: String(data.get("company") || ""),
      email: String(data.get("email") || ""),
      phone: String(data.get("phone") || ""),
      challenge: String(data.get("challenge") || ""),
      portals,
      // honeypot — real users never see or fill this field
      website: String(data.get("website") || ""),
    };

    try {
      const res = await fetch("/api/qbids", {
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
      setPortals([]);
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success" || status === "duplicate") {
    return (
      <div className="rounded-2xl border border-[#1e2a38] bg-[#111823] p-8 shadow-[0_24px_48px_-24px_rgba(63,208,201,0.15)]">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#3fd0c9]/30 bg-[#3fd0c9]/10">
            {status === "duplicate" ? (
              <Copy size={18} className="text-[#3fd0c9]" />
            ) : (
              <CheckCircle2 size={20} className="text-[#3fd0c9]" />
            )}
          </div>
          <p className="mt-4 font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#3fd0c9]">
            {status === "duplicate" ? "Already on the list" : "You're on the Qbids Beta list"}
          </p>
          <p className="mt-3 font-display text-lg font-semibold tracking-tight text-[#e6edf3]">
            {status === "duplicate"
              ? "This email is already registered — you're all set."
              : "We're inviting the first group of tender-active businesses to help shape Qbids."}
          </p>
          <p className="mt-2 text-sm text-[#8aa0b4]">
            We&apos;ll reach out personally at the email you provided when your beta access is ready.
          </p>
        </div>

        <div className="mt-8">
          <p className="text-center font-display text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8aa0b4]">
            What happens next?
          </p>
          <div className="mt-4 flex items-center justify-between gap-1">
            {nextSteps.map((step, i) => (
              <div key={step.label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-2 text-center">
                  <div
                    className={`h-2.5 w-2.5 rounded-full ${
                      step.done ? "bg-[#3fd0c9]" : "border border-[#1e2a38] bg-[#0c1016]"
                    }`}
                  />
                  <p className={`text-[11px] leading-tight ${step.done ? "text-[#e6edf3]" : "text-[#8aa0b4]"}`}>
                    {step.label}
                  </p>
                </div>
                {i < nextSteps.length - 1 && (
                  <div className="mx-1 mt-[-18px] h-px flex-1 bg-[#1e2a38]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="relative space-y-5 rounded-2xl border border-[#1e2a38] bg-[#111823] p-6 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)] sm:p-8"
    >
      {/* Honeypot field — hidden from real users via CSS, bots fill every field */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-xs font-medium uppercase tracking-wide text-[#8aa0b4]">
            Name *
          </label>
          <input id="name" name="name" type="text" required className={inputBase} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="company" className="text-xs font-medium uppercase tracking-wide text-[#8aa0b4]">
            Company *
          </label>
          <input id="company" name="company" type="text" required className={inputBase} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-[#8aa0b4]">
            Business email *
          </label>
          <input id="email" name="email" type="email" required className={inputBase} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="phone" className="text-xs font-medium uppercase tracking-wide text-[#8aa0b4]">
            Phone / WhatsApp *
          </label>
          <input id="phone" name="phone" type="tel" required className={inputBase} />
        </div>
      </div>

      <div>
        <p id="portals-label" className="text-xs font-medium uppercase tracking-wide text-[#8aa0b4]">
          Which portals do you use?
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-labelledby="portals-label">
          {PORTALS.map((p) => {
            const active = portals.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePortal(p)}
                aria-pressed={active}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "border-[#3fd0c9] bg-[#3fd0c9]/10 text-[#3fd0c9]"
                    : "border-[#1e2a38] bg-[#0c1016] text-[#8aa0b4] hover:border-[#3fd0c9]/50 hover:text-[#e6edf3]"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="challenge" className="text-xs font-medium uppercase tracking-wide text-[#8aa0b4]">
          Your biggest bidding challenge <span className="normal-case text-[#8aa0b4]/60">(optional)</span>
        </label>
        <textarea
          id="challenge"
          name="challenge"
          rows={3}
          placeholder="e.g. tracking deadlines across portals, chasing documents from teammates…"
          className={inputBase}
        />
      </div>

      {status === "error" && (
        <p role="alert" className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-[#3fd0c9] px-4 py-3 font-semibold text-[#0c1016] transition-colors hover:bg-[#22968f] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {status === "submitting" && <Loader2 size={15} className="animate-spin" />}
        {status === "submitting" ? "Joining…" : "Join Qbids Beta"}
      </button>

      <p className="text-xs text-[#8aa0b4]">
        We&apos;ll only use this to contact you about Qbids beta access. No spam, ever.
      </p>
    </form>
  );
}
