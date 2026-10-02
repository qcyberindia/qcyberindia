import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/qfinance/auth/AuthCard";
import { ResetPasswordForm } from "@/components/qfinance/auth/AuthForms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const raw = (await searchParams).token;
  const token = typeof raw === "string" ? raw : "";
  return (
    <AuthCard title="Choose a new password">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-[14.5px] text-[var(--qf-ink-soft)]">
          This page needs the link from your reset email.{" "}
          <Link href="/qfinera/forgot-password" className="font-semibold text-[var(--qf-brass-dark)] hover:underline">
            Request a new link
          </Link>
          .
        </p>
      )}
    </AuthCard>
  );
}
