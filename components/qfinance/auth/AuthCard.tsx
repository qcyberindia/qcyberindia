import QFinanceHeader from "@/components/qfinance/QFinanceHeader";

/** Centered, phone-first frame for sign-in and account-recovery pages. */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <QFinanceHeader />
      <main id="main" className="px-4 py-10 sm:py-16">
        <div className="mx-auto w-full max-w-md">
          <h1 className="text-center font-display text-[28px] font-semibold tracking-tight text-[var(--qf-ink)] sm:text-[32px]">{title}</h1>
          {subtitle && <p className="mx-auto mt-2 max-w-sm text-center text-[14.5px] leading-relaxed text-[var(--qf-ink-soft)]">{subtitle}</p>}
          <div className="mt-8 rounded-xl border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 sm:p-7">{children}</div>
        </div>
      </main>
    </div>
  );
}
