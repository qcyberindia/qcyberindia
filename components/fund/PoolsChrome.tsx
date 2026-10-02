// Frame for the pool pages outside one pool (list, create, join) and the
// signed-out explanation. Same QFinera header and footer as the rest of the product.
import Link from "next/link";
import { Lock, ShieldCheck, Users } from "lucide-react";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import { PRIVATE_POOL_NOTICE } from "@/lib/fund/product-gate";

export function PoolsChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <QFinanceHeader />
      <main id="fund-main" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        {children}
        <p className="mt-12 border-t border-[var(--qf-line)] pt-4 text-[12px] leading-relaxed text-[var(--qf-ink-soft)]">{PRIVATE_POOL_NOTICE}</p>
      </main>
      <QFinanceFooter />
    </div>
  );
}

/** Shown to signed-out visitors: what Pools are, then sign in / register. */
export function SignInGate({ message, next = "/qfinera/pools" }: { message: string; next?: string }) {
  const points = [
    { icon: Lock, title: "Private and invite-only", body: "Pools are never listed or searchable. People join only with a single-use invite sent to their email." },
    { icon: Users, title: "Shared, accurate records", body: "Contributions, units and NAV, trades, holdings, expenses and withdrawals, with a full audit trail." },
    { icon: ShieldCheck, title: "Your money stays with you", body: "QFinera never holds funds or places trades. It keeps the books for money your group manages itself." },
  ];
  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--qf-brass-dark)]">QFinera Pools</p>
      <h1 className="mt-2 font-display text-[30px] font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[38px]">
        Private spaces for groups to organize pooled trading, accounting and portfolio records.
      </h1>
      <p className="mt-3 text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">{message}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/qfinera/login?next=${encodeURIComponent(next)}`}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--qf-brass-dark)] px-5 py-2.5 font-display text-[15px] font-semibold text-[var(--qf-cream-0)] hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/qfinera/register"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--qf-line)] px-5 py-2.5 text-[15px] font-semibold text-[var(--qf-ink)] hover:border-[var(--qf-brass)]"
        >
          Create an account
        </Link>
      </div>
      <ul className="mt-10 grid gap-4 sm:grid-cols-3">
        {points.map((p) => (
          <li key={p.title} className="rounded-lg border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-4">
            <p.icon size={18} className="text-[var(--qf-brass-dark)]" aria-hidden="true" />
            <p className="mt-2 font-display text-[16px] font-semibold text-[var(--qf-ink)]">{p.title}</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--qf-ink-soft)]">{p.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
