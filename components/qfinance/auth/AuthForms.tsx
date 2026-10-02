"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { resetQFineraUser } from "@/components/qfinance/useQFineraUser";

type Fields = Record<string, string>;

async function post(path: string, body: unknown): Promise<{ ok: boolean; message?: string; fields?: Fields; data?: Record<string, unknown> }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok) return { ok: true, data: json.data };
    return { ok: false, message: json?.error?.message ?? "Something went wrong. Please try again.", fields: json?.error?.fields };
  } catch {
    return { ok: false, message: "Could not reach QFinera. Check your connection and try again." };
  }
}

const inputClass =
  "w-full min-h-11 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3.5 py-2.5 text-[16px] text-[var(--qf-ink)] outline-none transition-colors placeholder:text-[var(--qf-ink-soft)]/60 focus:border-[var(--qf-brass)] focus:ring-2 focus:ring-[var(--qf-brass)]/20 aria-[invalid=true]:border-[var(--qf-down)] sm:text-[15px]";
const labelClass = "text-[12px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]";
const primary =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--qf-brass-dark)] px-4 py-2.5 font-display text-[15px] font-semibold text-[var(--qf-cream-0)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)] disabled:cursor-not-allowed disabled:opacity-60";

function Field({
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  error,
  hint,
  inputMode,
}: {
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  error?: string;
  hint?: string;
  inputMode?: "email" | "text";
}) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && shown ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          inputMode={inputMode}
          autoCapitalize={type === "email" || isPassword ? "none" : undefined}
          spellCheck={false}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={`${inputClass} ${isPassword ? "pr-11" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide password" : "Show password"}
            aria-pressed={shown}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--qf-ink-soft)] hover:text-[var(--qf-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]"
          >
            {shown ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-err`} className="text-[12.5px] font-medium text-[var(--qf-down)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-[12.5px] text-[var(--qf-ink-soft)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-md border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10 px-3.5 py-2.5 text-[13.5px] text-[var(--qf-ink)]">
      {children}
    </p>
  );
}

function Done({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="status" className="space-y-3 text-center">
      <CheckCircle2 size={36} className="mx-auto text-[var(--qf-fix)]" aria-hidden="true" />
      <p className="font-display text-xl font-semibold text-[var(--qf-ink)]">{title}</p>
      <div className="text-[14.5px] leading-relaxed text-[var(--qf-ink-soft)]">{children}</div>
    </div>
  );
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" className={primary} disabled={pending}>
      {pending && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {children}
    </button>
  );
}

function goTo(next: string) {
  resetQFineraUser();
  // A full navigation so every part of the page sees the new session.
  window.location.assign(next);
}

export function LoginForm({ next, notice }: { next: string; notice: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const r = await post("/api/qfinera/auth/login", { email, password });
        if (r.ok) return goTo(next);
        setError(r.message ?? null);
        setPending(false);
      }}
    >
      {notice && (
        <p className="rounded-md border border-[var(--qf-brass)]/40 bg-[var(--qf-brass)]/10 px-3.5 py-2.5 text-[13.5px] text-[var(--qf-ink)]">{notice}</p>
      )}
      <Field label="Email" type="email" inputMode="email" value={email} onChange={setEmail} autoComplete="email" />
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      <div className="flex justify-end">
        <Link href="/qfinera/forgot-password" className="text-[13.5px] font-medium text-[var(--qf-brass-dark)] underline-offset-2 hover:underline">
          Forgot password?
        </Link>
      </div>
      {error && <Alert>{error}</Alert>}
      <Submit pending={pending}>Sign in</Submit>
      <p className="text-center text-[14px] text-[var(--qf-ink-soft)]">
        New to QFinera?{" "}
        <Link href={`/qfinera/register${next !== "/qfinera/pools" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [acceptTerms, setAccept] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>({});
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Done title="Check your email">
        <p>
          We sent a confirmation link to <strong className="text-[var(--qf-ink)]">{email}</strong>. Open it and enter the password you just chose to
          finish creating your account.
        </p>
        <p className="mt-2 text-[13px]">Didn&rsquo;t get it after a few minutes? Check spam, or register again to resend.</p>
      </Done>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setFields({});
        setError(null);
        if (password !== confirmPassword) {
          setFields({ confirmPassword: "The passwords do not match." });
          return;
        }
        setPending(true);
        const r = await post("/api/qfinera/auth/register", { displayName, email, password, confirmPassword, acceptTerms });
        setPending(false);
        if (r.ok) return setDone(true);
        setFields(r.fields ?? {});
        setError(r.message ?? null);
      }}
    >
      <Field label="Display name" value={displayName} onChange={setDisplayName} autoComplete="nickname" error={fields.displayName} hint="Shown in the Community and to members of your pools." />
      <Field label="Email" type="email" inputMode="email" value={email} onChange={setEmail} autoComplete="email" error={fields.email} hint="Private. Never shown publicly." />
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" error={fields.password} hint="At least 10 characters. A short phrase works well." />
      <Field label="Confirm password" type="password" value={confirmPassword} onChange={setConfirm} autoComplete="new-password" error={fields.confirmPassword} />
      <label className="flex items-start gap-3 text-[13.5px] leading-relaxed text-[var(--qf-ink)]">
        <input type="checkbox" checked={acceptTerms} onChange={(e) => setAccept(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" required />
        <span>
          I agree to use QFinera for my own learning, discussion and record-keeping. QFinera does not give investment advice, hold money, or
          guarantee returns.
        </span>
      </label>
      {fields.acceptTerms && <p className="text-[12.5px] font-medium text-[var(--qf-down)]">{fields.acceptTerms}</p>}
      {error && !Object.keys(fields).length && <Alert>{error}</Alert>}
      <Submit pending={pending}>Create account</Submit>
      <p className="text-center text-[14px] text-[var(--qf-ink-soft)]">
        Already have an account?{" "}
        <Link href="/qfinera/login" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const r = await post("/api/qfinera/auth/verify-email", { token, password });
        if (r.ok) return goTo("/qfinera/pools?welcome=1");
        setError(r.message ?? null);
        setPending(false);
      }}
    >
      <p className="text-[14.5px] text-[var(--qf-ink-soft)]">
        To confirm it&rsquo;s really you, enter the password you chose when you registered.
      </p>
      <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
      {error && <Alert>{error}</Alert>}
      <Submit pending={pending}>Confirm and sign in</Submit>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <Done title="Check your email">
        <p>If an account uses that email, we&rsquo;ve sent a link to set a new password. It expires in 30 minutes.</p>
        <p className="mt-2 text-[13px]">Signed up with an email link before passwords existed? This is also how you set your first password.</p>
      </Done>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError(null);
        const r = await post("/api/qfinera/auth/forgot-password", { email });
        setPending(false);
        if (r.ok) setDone(true);
        else setError(r.message ?? null);
      }}
    >
      <Field label="Email" type="email" inputMode="email" value={email} onChange={setEmail} autoComplete="email" />
      {error && <Alert>{error}</Alert>}
      <Submit pending={pending}>Send reset link</Submit>
      <p className="text-center text-[14px]">
        <Link href="/qfinera/login" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>({});
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <Done title="Password updated">
        <p>You&rsquo;ve been signed out everywhere. Sign in with your new password.</p>
        <Link href="/qfinera/login" className={`${primary} mt-4`}>
          Sign in
        </Link>
      </Done>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setFields({});
        setError(null);
        if (password !== confirmPassword) return setFields({ confirmPassword: "The passwords do not match." });
        setPending(true);
        const r = await post("/api/qfinera/auth/reset-password", { token, password, confirmPassword });
        setPending(false);
        if (r.ok) {
          resetQFineraUser();
          return setDone(true);
        }
        setFields(r.fields ?? {});
        setError(r.message ?? null);
      }}
    >
      <Field label="New password" type="password" value={password} onChange={setPassword} autoComplete="new-password" error={fields.password} hint="At least 10 characters." />
      <Field label="Confirm new password" type="password" value={confirmPassword} onChange={setConfirm} autoComplete="new-password" error={fields.confirmPassword} />
      {error && !Object.keys(fields).length && <Alert>{error}</Alert>}
      <Submit pending={pending}>Set new password</Submit>
    </form>
  );
}
