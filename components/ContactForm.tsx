"use client";

import { useState, FormEvent, ChangeEvent } from "react";

type Status = "idle" | "submitting" | "success" | "error";
type Touched = { name?: boolean; email?: boolean; message?: boolean };

const inputBase =
  "w-full rounded-md border bg-[#ffffff] px-3.5 py-2.5 text-[var(--color-navy)] outline-none transition-colors focus:ring-2 focus:ring-[var(--color-red)]/10";

function fieldClass(invalid: boolean) {
  return `${inputBase} ${
    invalid
      ? "border-[#dc2626] focus:border-[#dc2626]"
      : "border-[var(--color-line)] focus:border-[var(--color-red)]"
  }`;
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [values, setValues] = useState({ name: "", email: "", company: "", message: "" });
  const [touched, setTouched] = useState<Touched>({});

  const errors = {
    name: touched.name && values.name.trim() === "" ? "Please enter your name." : "",
    email:
      touched.email && values.email.trim() === ""
        ? "Please enter your email."
        : touched.email && !isValidEmail(values.email)
        ? "That doesn't look like a valid email."
        : "",
    message: touched.message && values.message.trim() === "" ? "Let us know what you need." : "",
  };

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setValues((v) => ({ ...v, [name]: value }));
  }

  function handleBlur(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setTouched((t) => ({ ...t, [e.target.name]: true }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched({ name: true, email: true, message: true });

    if (values.name.trim() === "" || !isValidEmail(values.email) || values.message.trim() === "") {
      return;
    }

    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: values.name,
      email: values.email,
      company: values.company,
      message: values.message,
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
      setValues({ name: "", email: "", company: "", message: "" });
      setTouched({});
    } catch {
      setStatus("error");
      setErrorMsg("Network error. Check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm">
        <p className="font-mono text-sm text-[var(--color-gold)]">MESSAGE SENT</p>
        <p className="mt-2 text-[var(--color-navy)]">
          Thanks for reaching out — we typically reply within one business day.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5 rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-sm sm:p-8"
    >
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
          value={values.name}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          className={fieldClass(!!errors.name)}
        />
        {errors.name && (
          <p id="name-error" className="mt-1.5 text-xs text-[#dc2626]">
            {errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block font-mono text-xs text-[var(--color-fog)] mb-1.5">
          EMAIL
        </label>
        <input
          id="email"
          name="email"
          type="email"
          value={values.email}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          className={fieldClass(!!errors.email)}
        />
        {errors.email && (
          <p id="email-error" className="mt-1.5 text-xs text-[#dc2626]">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="company" className="block font-mono text-xs text-[var(--color-fog)] mb-1.5">
          COMPANY <span className="text-[var(--color-fog)]/60">(optional)</span>
        </label>
        <input
          id="company"
          name="company"
          type="text"
          value={values.company}
          onChange={handleChange}
          className={fieldClass(false)}
        />
      </div>

      <div>
        <label htmlFor="message" className="block font-mono text-xs text-[var(--color-fog)] mb-1.5">
          MESSAGE
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          value={values.message}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? "message-error" : undefined}
          className={fieldClass(!!errors.message)}
        />
        {errors.message && (
          <p id="message-error" className="mt-1.5 text-xs text-[#dc2626]">
            {errors.message}
          </p>
        )}
      </div>

      {status === "error" && <p className="font-mono text-sm text-[#dc2626]">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="btn btn-primary transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === "submitting" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
