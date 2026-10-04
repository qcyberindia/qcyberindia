import type { Metadata } from "next";
import Link from "next/link";
import QFinanceHeader from "@/components/qfinance/QFinanceHeader";
import QFinanceFooter from "@/components/qfinance/QFinanceFooter";
import BetaRegisterForm from "@/components/qfinance/BetaRegisterForm";
import Reveal from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Product updates",
  description: "Hear when new QFinera features become available.",
  alternates: { canonical: "/qfinera/beta" },
};

export default function BetaPage() {
  return (
    <div>
      <QFinanceHeader />
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-md">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--qf-brass-dark)]">
              Product updates
            </p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--qf-ink)] sm:text-4xl">
              Hear what&apos;s next
            </h1>
            <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--qf-ink-soft)]">
              Learn is free for everyone, and a{" "}
              <Link href="/qfinera/register" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
                free account
              </Link>{" "}
              gives you Community, Global Watch and Pools today. Leave your details to hear when{" "}
              <Link href="/qfinera/roadmap" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
                features under development
              </Link>{" "}
              become available.
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
