import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/qfinance/auth/AuthCard";
import { VerifyEmailForm } from "@/components/qfinance/auth/AuthForms";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  return (
    <AuthCard title="Confirm your email">
      {token ? (
        <VerifyEmailForm token={token} />
      ) : (
        <p className="text-[14.5px] text-[var(--qf-ink-soft)]">
          Open the full link from your confirmation email, or{" "}
          <Link href="/qfinera/register" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
            register again
          </Link>{" "}
          to get a new one.
        </p>
      )}
    </AuthCard>
  );
}
