"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import AdminLoadingState from "@/components/admin/AdminLoadingState";

type Detail = {
  user: {
    id: number; displayName: string; email: string; status: string; createdAt: string; lastLoginAt: string | null;
    emailVerifiedAt: string | null; passwordUpdatedAt: string | null; hasPassword: boolean; platformRole: string;
  };
  memberships: Array<{ poolId: number; poolName: string; role: string; status: string; joinedAt: string }>;
  sessions: Array<{ id: number; createdAt: string; lastSeenAt: string; expiresAt: string; userAgent: string | null }>;
  events: Array<{ id: number; action: string; details: Record<string, unknown> | null; createdAt: string }>;
  community: { posts: number; replies: number };
};

const date = (v: string | null) =>
  v ? new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const btn = "rounded-md border border-[var(--color-line)] bg-white px-3.5 py-2 text-sm font-medium transition-colors hover:border-[var(--color-navy)]/40 disabled:opacity-50";

export default function AdminQFineraUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/qfinance/users/${encodeURIComponent(id)}`)
      .then((r) => r.json())
      .then((j) => !cancelled && (j.ok ? setData(j.data) : setError(j.error?.message ?? "Failed to load user")))
      .catch(() => !cancelled && setError("Failed to load user"));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function act(action: string, success: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(`/api/admin/qfinance/users/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason, ...extra }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error?.message ?? "Action failed");
      else {
        setData(j.data);
        setNotice(success);
        setReason("");
      }
    } catch {
      setError("Action failed");
    } finally {
      setBusy(false);
    }
  }

  const needsReason = reason.trim().length < 3;

  return (
    <div>
      <Link href="/admin/qfinance/users" className="text-sm text-[var(--color-navy)] hover:underline">← All QFinera users</Link>
      {!data && !error && <AdminLoadingState />}
      {error && <p className="mt-4 rounded-md border border-[var(--color-red)]/30 bg-[var(--color-red)]/5 px-3 py-2 text-sm text-[var(--color-red-deep)]">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-md border border-green-700/30 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
      {data && (
        <>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-[var(--color-ink)]">{data.user.displayName}</h1>
          <dl className="mt-4 grid max-w-3xl grid-cols-1 gap-3 rounded-xl border border-[var(--color-line)] bg-white p-5 text-sm sm:grid-cols-2">
            {[
              ["Email", data.user.email],
              ["Status", data.user.status === "active" ? "Active" : "Suspended"],
              ["Registered", date(data.user.createdAt)],
              ["Last login", date(data.user.lastLoginAt)],
              ["Email verified", date(data.user.emailVerifiedAt)],
              ["Password", data.user.hasPassword ? `Set (changed ${date(data.user.passwordUpdatedAt)})` : "Not set (email-link account)"],
              ["Community", `${data.community.posts} posts, ${data.community.replies} replies`],
              ["Active sessions", String(data.sessions.length)],
              ["Global Watch role", data.user.platformRole === "USER" ? "Member" : data.user.platformRole === "MANAGER" ? "Moderator (manager)" : "Administrator"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fog)]">{k}</dt>
                <dd className="mt-0.5 text-[var(--color-ink)]">{v}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-6 max-w-3xl rounded-xl border border-[var(--color-line)] bg-white p-5">
            <h2 className="font-display text-base font-semibold">Actions</h2>
            <label htmlFor="admin-reason" className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fog)]">
              Reason (recorded; required for suspend, restore and sign-out)
            </label>
            <input id="admin-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="mt-1 w-full rounded-md border border-[var(--color-line)] px-3 py-2 text-sm" />
            <div className="mt-3 flex flex-wrap gap-2">
              {data.user.status === "active" ? (
                <button type="button" className={btn} disabled={busy || needsReason} onClick={() => act("suspend", "Account suspended and signed out everywhere.")}>Suspend</button>
              ) : (
                <button type="button" className={btn} disabled={busy || needsReason} onClick={() => act("restore", "Account restored.")}>Restore</button>
              )}
              <button type="button" className={btn} disabled={busy || needsReason} onClick={() => act("revoke-sessions", "All sessions signed out.")}>Sign out everywhere</button>
              <button type="button" className={btn} disabled={busy || data.user.status !== "active"} onClick={() => act("send-password-reset", "A password reset link was emailed to the user.")}>Send password reset</button>
            </div>
            <div className="mt-5 border-t border-[var(--color-line)] pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fog)]">Global Watch moderation (reason required)</p>
              <p className="mt-1 text-sm text-[var(--color-fog)]">
                Managers archive anyone&apos;s item; their edits and deletions of others&apos; items wait for an administrator. Administrators can do everything.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["USER", "MANAGER", "ADMIN"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={btn}
                    disabled={busy || needsReason || data.user.platformRole === r}
                    onClick={() => act("set-platform-role", "Global Watch role updated.", { platformRole: r })}
                  >
                    {r === "USER" ? "Member" : r === "MANAGER" ? "Make moderator" : "Make administrator"}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-6 max-w-3xl">
            <h2 className="font-display text-base font-semibold">Pool memberships</h2>
            {data.memberships.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-fog)]">Not a member of any pool.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-white text-sm">
                {data.memberships.map((m) => (
                  <li key={m.poolId} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                    <span className="font-medium">{m.poolName}</span>
                    <span className="text-[var(--color-fog)]">{m.role} · {m.status} · joined {date(m.joinedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6 max-w-3xl">
            <h2 className="font-display text-base font-semibold">Admin history</h2>
            {data.events.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--color-fog)]">No admin actions.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--color-line)] rounded-xl border border-[var(--color-line)] bg-white text-sm">
                {data.events.map((e) => (
                  <li key={e.id} className="px-4 py-3">
                    <span className="font-medium">{e.action}</span> <span className="text-[var(--color-fog)]">· {date(e.createdAt)}</span>
                    {typeof e.details?.reason === "string" && <p className="mt-0.5 text-[var(--color-fog)]">Reason: {e.details.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
