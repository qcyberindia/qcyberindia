// Server-side gate shared by every Fund page: authentication -> membership ->
// render. The fund id from ?fund= is only a REQUEST; resolveFundContext
// decides from the database whether this user may see that fund.
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { FundShell, type NavKey } from "@/components/fund/FundShell";
import { EmptyState, ErrorState, SectionCard } from "@/components/fund/ui";
import { loadPageContext, parseFundParam, type FundContext, type PageContext } from "@/lib/fund/auth";
import { FundError } from "@/lib/fund/errors";

export type SearchParams = Record<string, string | string[] | undefined>;

function Centered({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10">{children}</div>;
}

export async function withFundPage(opts: {
  searchParams: Promise<SearchParams>;
  active: NavKey;
  render: (ctx: FundContext, sp: SearchParams) => Promise<ReactNode> | ReactNode;
}): Promise<ReactNode> {
  const sp = await opts.searchParams;

  let state: PageContext;
  try {
    state = await loadPageContext(parseFundParam(sp.fund));
  } catch (err) {
    if ((err as { digest?: unknown } | null)?.digest) throw err;
    console.error("QFinera Fund: could not load page context:", err);
    return (
      <Centered>
        <ErrorState title="The Fund workspace is not available right now">
          Please try again in a few minutes.
        </ErrorState>
      </Centered>
    );
  }

  if (state.state === "unauthenticated") {
    return (
      <Centered>
        <SectionCard title="Sign in to QFinera Fund">
          <p className="text-sm text-[var(--qf-ink-soft)]">
            QFinera Fund is a private workspace. Sign in with the email link you use for QFinera, then return here.
          </p>
          <Link
            href="/qfinera/community"
            className="mt-4 inline-flex rounded-lg border border-[var(--qf-brass)] bg-[var(--qf-brass)] px-4 py-2 text-sm font-medium text-[var(--qf-cream-0)]"
          >
            Go to sign in
          </Link>
        </SectionCard>
      </Centered>
    );
  }

  if (state.state === "no-membership") {
    return (
      <Centered>
        <EmptyState title="You are not a member of a fund">
          Hello {state.displayName}. Access to QFinera Fund is by invitation only. Ask a fund administrator to invite
          you.
        </EmptyState>
      </Centered>
    );
  }

  if (state.state === "suspended") {
    return (
      <Centered>
        <ErrorState title="Your fund membership is suspended">
          Please contact a fund administrator.
        </ErrorState>
      </Centered>
    );
  }

  const { ctx } = state;
  let body: ReactNode = null;
  let missing = false;
  try {
    body = await opts.render(ctx, sp);
  } catch (err) {
    // Next.js control-flow errors (redirect, notFound) carry a digest: let them through.
    if ((err as { digest?: unknown } | null)?.digest) throw err;
    if (err instanceof FundError && err.code === "NOT_FOUND") {
      missing = true;
    } else if (err instanceof FundError) {
      body = <ErrorState title="That could not be completed">{err.message}</ErrorState>;
    } else {
      console.error("QFinera Fund: page render failed:", err);
      body = (
        <ErrorState title="Something went wrong">
          This page could not be loaded. Please try again.
        </ErrorState>
      );
    }
  }
  if (missing) notFound();

  return (
    <FundShell ctx={ctx} active={opts.active}>
      {body}
    </FundShell>
  );
}
