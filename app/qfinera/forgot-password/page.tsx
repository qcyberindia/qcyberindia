import type { Metadata } from "next";
import { AuthCard } from "@/components/qfinance/auth/AuthCard";
import { ForgotPasswordForm } from "@/components/qfinance/auth/AuthForms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      <ForgotPasswordForm />
    </AuthCard>
  );
}
