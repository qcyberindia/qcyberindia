import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import { AccountView } from "@/components/qfinance/auth/AccountView";
import { getQFinanceServerSession } from "@/lib/qfinance-community-auth";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default async function AccountPage() {
  const session = await getQFinanceServerSession();
  if (!session) redirect("/qfinera/login?next=/qfinera/account&notice=required");
  return (
    <div>
      <QFinanceHeader />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--qf-brass-dark)]">Account</p>
        <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[34px]">Hello, {session.displayName}</h1>
        <p className="mt-1 text-[14.5px] text-[var(--qf-ink-soft)]">Your private account details. Only you can see this page.</p>
        <div className="mt-8">
          <AccountView />
        </div>
      </main>
      <QFinanceFooter />
    </div>
  );
}
