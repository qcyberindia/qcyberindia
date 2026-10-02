"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, apiFetch, type InvitePreviewDto } from "@/components/fund/api";
import { DateDisplay } from "@/components/fund/display";
import { humanize } from "@/components/fund/format";
import { POOLS_BASE, poolBase } from "@/components/fund/nav";
import { ErrorState, LoadingSkeleton, PageHeader, SectionCard, btnPrimary } from "@/components/fund/parts";

export function JoinInvite({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<InvitePreviewDto | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<{ invite: InvitePreviewDto }>("/api/qfinera/pools/join", { query: { token }, signal: controller.signal })
      .then((d) => setInvite(d.invite))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof ApiError ? err : new ApiError("ERROR", "Could not open this invite.", 0));
      });
    return () => controller.abort();
  }, [token]);

  async function accept() {
    setPending(true);
    try {
      const { poolId } = await apiFetch<{ poolId: number }>("/api/qfinera/pools/join", { body: { token } });
      router.push(`${poolBase(poolId)}/dashboard`);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("ERROR", "Could not join the pool.", 0));
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="QFinera Pools" title="Pool invitation" />
      <SectionCard>
        {error ? (
          <div>
            <ErrorState error={error} />
            <p className="text-center text-[13.5px]">
              <Link className="text-[var(--qf-brass-dark)] underline underline-offset-2" href={POOLS_BASE}>
                Go to your pools
              </Link>
            </p>
          </div>
        ) : !invite ? (
          <LoadingSkeleton label="Checking the invitation" />
        ) : !invite.emailMatches ? (
          <div className="space-y-2 text-[14px]">
            <p>
              This invitation was sent to a different email address. You are signed in as <strong>{email}</strong>.
            </p>
            <p className="text-[var(--qf-ink-soft)]">Sign in with the invited email address to accept it.</p>
          </div>
        ) : (
          <div className="space-y-4 text-[14px]">
            <p>
              {invite.invitedBy ?? "A pool administrator"} invited you to join <strong>{invite.poolName}</strong> as a{" "}
              {humanize(invite.role)}.
            </p>
            <p className="text-[13px] text-[var(--qf-ink-soft)]">
              This is a private pool. Joining gives you no units by itself: units come only from contributions you make and the pool
              administrator approves. The invitation expires <DateDisplay value={invite.expiresAt} />.
            </p>
            <button type="button" className={btnPrimary} onClick={() => void accept()} disabled={pending}>
              Join pool
            </button>
          </div>
        )}
      </SectionCard>
    </>
  );
}

/** "Join a pool" without a token in the URL: paste the invitation link (or its code). */
export function JoinWithLink() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <PageHeader eyebrow="QFinera Pools" title="Join a pool" description="Pools are invite-only. Use the link from the invitation email a pool administrator sent you." />
      <SectionCard>
        <form
          className="max-w-xl space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            let token = value.trim();
            try {
              token = new URL(token).searchParams.get("token") ?? token;
            } catch {
              // not a URL: treat the input as the code itself
            }
            if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
              setError("That doesn't look like a QFinera invitation link.");
              return;
            }
            router.push(`${POOLS_BASE}/join?token=${encodeURIComponent(token)}`);
          }}
        >
          <label htmlFor="invite-link-input" className="text-[12px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">
            Invitation link
          </label>
          <input
            id="invite-link-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full min-h-11 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3.5 py-2.5 text-[16px] outline-none focus:border-[var(--qf-brass)] sm:text-[15px]"
            placeholder="https://…/qfinera/pools/join?token=…"
            autoComplete="off"
            spellCheck={false}
          />
          {error && (
            <p role="alert" className="text-[13px] font-medium text-[var(--qf-down)]">
              {error}
            </p>
          )}
          <button type="submit" className={btnPrimary}>
            Continue
          </button>
          <p className="text-[13px] text-[var(--qf-ink-soft)]">No invitation? Ask someone in the pool, or create your own pool.</p>
        </form>
      </SectionCard>
    </>
  );
}
