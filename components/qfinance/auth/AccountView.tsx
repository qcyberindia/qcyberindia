"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { resetQFineraUser } from "@/components/qfinance/useQFineraUser";

type Account = {
  account: {
    userId: number;
    displayName: string;
    email: string;
    status: string;
    createdAt: string;
    lastLoginAt: string | null;
    passwordUpdatedAt: string | null;
    emailVerifiedAt: string | null;
  };
  sessions: Array<{ id: number; createdAt: string; lastSeenAt: string; expiresAt: string; userAgent: string | null; current: boolean }>;
  pools: Array<{ id: number; name: string; role: string; membershipStatus: string }>;
};

async function call(path: string, body: unknown, method = "POST") {
  const res = await fetch(path, { method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) throw new Error(json?.error?.message ?? "Something went wrong. Please try again.");
  return json.data;
}

const card = "rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-0)] p-5 sm:p-6";
const h2 = "font-display text-[19px] font-semibold text-[var(--qf-ink)]";
const input =
  "w-full min-h-11 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3.5 py-2.5 text-[16px] text-[var(--qf-ink)] outline-none focus:border-[var(--qf-brass)] focus:ring-2 focus:ring-[var(--qf-brass)]/20 sm:text-[15px]";
const label = "text-[12px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]";
const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--qf-brass-dark)] px-4 py-2 font-display text-[14.5px] font-semibold text-[var(--qf-cream-0)] hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)] disabled:opacity-60";
const btn2 =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-4 py-2 text-[14px] font-semibold text-[var(--qf-ink)] hover:border-[var(--qf-brass)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-brass)] disabled:opacity-60";

const when = (v: string | null) =>
  v ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v)) : "—";

function device(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Firefox\//.test(ua) ? "Firefox" : /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

function Message({ kind, text }: { kind: "ok" | "err"; text: string }) {
  return (
    <p role={kind === "err" ? "alert" : "status"} className={`mt-3 rounded-md px-3 py-2 text-[13.5px] ${kind === "err" ? "border border-[var(--qf-down)]/30 bg-[var(--qf-down)]/10" : "border border-[var(--qf-fix)]/30 bg-[var(--qf-fix-bg)]"}`}>
      {text}
    </p>
  );
}

export function AccountView() {
  const [data, setData] = useState<Account | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    fetch("/api/qfinera/account", { credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!alive) return;
        if (r.status === 401) window.location.assign("/qfinera/login?next=/qfinera/account&notice=required");
        else if (j?.ok) setData(j.data);
        else setLoadError(j?.error?.message ?? "Could not load your account.");
      })
      .catch(() => alive && setLoadError("Could not load your account."));
    return () => {
      alive = false;
    };
  }, [version]);

  const [name, setName] = useState<string | null>(null);
  const [nameMsg, setNameMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pw, setPw] = useState({ currentPassword: "", password: "", confirmPassword: "" });
  const [pwMsg, setPwMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [sessMsg, setSessMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (loadError) return <Message kind="err" text={loadError} />;
  if (!data) {
    return (
      <div role="status" className="flex items-center gap-2 text-[14px] text-[var(--qf-ink-soft)]">
        <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Loading your account…
      </div>
    );
  }
  const a = data.account;
  const others = data.sessions.filter((s) => !s.current).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="profile-h" className={card}>
        <h2 id="profile-h" className={h2}>Profile</h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy("name");
            setNameMsg(null);
            try {
              await call("/api/qfinera/account", { displayName: name ?? a.displayName }, "PATCH");
              setNameMsg({ kind: "ok", text: "Display name updated." });
              resetQFineraUser();
              reload();
            } catch (err) {
              setNameMsg({ kind: "err", text: (err as Error).message });
            } finally {
              setBusy(null);
            }
          }}
        >
          <label htmlFor="acct-name" className={label}>Display name</label>
          <input id="acct-name" className={input} value={name ?? a.displayName} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="nickname" />
          <p className="text-[12.5px] text-[var(--qf-ink-soft)]">Shown on your Community posts and to members of your pools. Your email is never shown publicly.</p>
          <button type="submit" className={btn2} disabled={busy === "name" || (name ?? a.displayName).trim() === a.displayName}>Save name</button>
          {nameMsg && <Message {...nameMsg} />}
        </form>
        <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-[var(--qf-line)] pt-5 text-[14px] sm:grid-cols-2">
          {[
            ["Email (private)", a.email],
            ["Account", a.status === "active" ? "Active" : "Suspended"],
            ["Email confirmed", a.emailVerifiedAt ? when(a.emailVerifiedAt) : "Not yet"],
            ["Member since", when(a.createdAt)],
            ["Last sign-in", when(a.lastLoginAt)],
            ["Password changed", when(a.passwordUpdatedAt)],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className={label}>{k}</dt>
              <dd className="mt-0.5 break-words text-[var(--qf-ink)]">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="pw-h" className={card}>
        <h2 id="pw-h" className={h2}>Change password</h2>
        <p className="mt-1 text-[13.5px] text-[var(--qf-ink-soft)]">Changing your password signs you out on every other device.</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setPwMsg(null);
            if (pw.password !== pw.confirmPassword) return setPwMsg({ kind: "err", text: "The new passwords do not match." });
            setBusy("pw");
            try {
              await call("/api/qfinera/account/password", pw);
              setPw({ currentPassword: "", password: "", confirmPassword: "" });
              setPwMsg({ kind: "ok", text: "Password changed. Other devices have been signed out." });
              reload();
            } catch (err) {
              setPwMsg({ kind: "err", text: (err as Error).message });
            } finally {
              setBusy(null);
            }
          }}
        >
          {(
            [
              ["currentPassword", "Current password", "current-password"],
              ["password", "New password", "new-password"],
              ["confirmPassword", "Confirm new password", "new-password"],
            ] as const
          ).map(([k, l, ac]) => (
            <div key={k} className="flex flex-col gap-1.5">
              <label htmlFor={`pw-${k}`} className={label}>{l}</label>
              <input id={`pw-${k}`} type="password" className={input} autoComplete={ac} value={pw[k]} onChange={(e) => setPw((p) => ({ ...p, [k]: e.target.value }))} required />
            </div>
          ))}
          <button type="submit" className={btn} disabled={busy === "pw"}>
            {busy === "pw" && <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Change password
          </button>
          {pwMsg && <Message {...pwMsg} />}
        </form>
      </section>

      <section aria-labelledby="sess-h" className={card}>
        <h2 id="sess-h" className={h2}>Where you&rsquo;re signed in</h2>
        <p className="mt-1 text-[13.5px] text-[var(--qf-ink-soft)]">Sessions last 30 days from sign-in, then you sign in again.</p>
        <ul className="mt-4 divide-y divide-[var(--qf-line)] text-[14px]">
          {data.sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-medium text-[var(--qf-ink)]">
                  {device(s.userAgent)} {s.current && <span className="ml-1 rounded-full bg-[var(--qf-fix-bg)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--qf-fix)]">This device</span>}
                </p>
                <p className="text-[12.5px] text-[var(--qf-ink-soft)]">Active {when(s.lastSeenAt)} · expires {when(s.expiresAt)}</p>
              </div>
              {!s.current && (
                <button
                  type="button"
                  className="min-h-10 rounded-md px-2 text-[13.5px] font-semibold text-[var(--qf-down)] underline-offset-2 hover:underline"
                  disabled={busy !== null}
                  onClick={async () => {
                    setBusy(`s${s.id}`);
                    try {
                      await call("/api/qfinera/account/sessions", { sessionId: s.id });
                      setSessMsg({ kind: "ok", text: "That device has been signed out." });
                      reload();
                    } catch (err) {
                      setSessMsg({ kind: "err", text: (err as Error).message });
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {others > 0 && (
            <button
              type="button"
              className={btn2}
              disabled={busy !== null}
              onClick={async () => {
                setBusy("all");
                try {
                  await call("/api/qfinera/account/sessions", { all: true });
                  setSessMsg({ kind: "ok", text: "All other devices have been signed out." });
                  reload();
                } catch (err) {
                  setSessMsg({ kind: "err", text: (err as Error).message });
                } finally {
                  setBusy(null);
                }
              }}
            >
              Sign out other devices ({others})
            </button>
          )}
          <button
            type="button"
            className={btn2}
            disabled={busy !== null}
            onClick={async () => {
              setBusy("logout");
              await call("/api/qfinera/auth/logout", {}).catch(() => undefined);
              resetQFineraUser();
              window.location.assign("/qfinera/login?notice=signed-out");
            }}
          >
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </div>
        {sessMsg && <Message {...sessMsg} />}
      </section>

      <section aria-labelledby="pools-h" className={card}>
        <h2 id="pools-h" className={h2}>Your pools</h2>
        {data.pools.length === 0 ? (
          <p className="mt-2 text-[14px] text-[var(--qf-ink-soft)]">
            You&rsquo;re not in a pool yet.{" "}
            <Link href="/qfinera/pools/create" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">Create one</Link> or ask for an invite.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--qf-line)] text-[14px]">
            {data.pools.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-3">
                <Link href={`/qfinera/pools/${p.id}/dashboard`} className="min-w-0 truncate font-medium text-[var(--qf-ink)] hover:text-[var(--qf-brass-dark)]">{p.name}</Link>
                <span className="shrink-0 text-[12.5px] text-[var(--qf-ink-soft)]">
                  {p.role.charAt(0) + p.role.slice(1).toLowerCase()}
                  {p.membershipStatus !== "active" ? ` · ${p.membershipStatus}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
