import type { Metadata } from "next";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import BetaRegisterForm from "@/components/qfinance/BetaRegisterForm";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Join the Beta",
  description: "Register for early QFinera beta access.",
  alternates: { canonical: "/qfinera/beta" },
};

export default function BetaPage() {
  return (
    <div>
      <QFinanceHeader />
      <section className="px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-md">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">
              QFinera Beta
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--qf-ink)] sm:text-4xl">
              Join the Beta
            </h1>
            <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              The Beginner Journey is already live and free to use — no registration required.
              Joining the beta gets you early access to what comes after it, as it&apos;s built.
            </p>

            <div className="mt-8">
              <BetaRegisterForm />
            </div>
          </Reveal>
        </div>
      </section>
      <QFinanceFooter />
    </div>
  );
}
