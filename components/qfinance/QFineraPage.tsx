// Standard frame for QFinera pages outside a pool: the product header, an
// optional page intro (eyebrow, title, one-line description), the content,
// and the footer. Server component.
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";

export default function QFineraPage({
  eyebrow,
  title,
  description,
  actions,
  width = "default",
  children,
}: {
  eyebrow?: string;
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  width?: "default" | "narrow";
  children: React.ReactNode;
}) {
  const max = width === "narrow" ? "max-w-3xl" : "max-w-6xl";
  return (
    <div className="flex min-h-dvh flex-col">
      <QFinanceHeader />
      <main id="main" className={`mx-auto w-full flex-1 ${max} px-4 pb-16 pt-8 sm:px-6 sm:pt-12`}>
        {title && (
          <header className="mb-8 flex flex-col gap-4 border-b border-[var(--qf-line)]/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              {eyebrow && <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--qf-brass-dark)]">{eyebrow}</p>}
              <h1 className="mt-1.5 font-display text-[30px] font-semibold leading-tight tracking-tight text-[var(--qf-ink)] sm:text-[40px]">{title}</h1>
              {description && <p className="mt-2 max-w-2xl text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
          </header>
        )}
        {children}
      </main>
      <QFinanceFooter />
    </div>
  );
}
