import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/qfinance/auth/AuthCard";
import { LoginForm } from "@/components/qfinance/auth/AuthForms";
import { safeNext } from "@/components/qfinance/qfinera-nav";
import { getQFinanceServerSession } from "@/lib/qfinance-community-auth";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const NOTICES: Record<string, string> = {
  "link-retired": "Email sign-in links have been replaced by passwords. If you joined with an email link, use \u201cForgot password?\u201d to set one; your account and history are unchanged.",
  "signed-out": "You have been signed out.",
  required: "Please sign in to continue.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getQFinanceServerSession()) redirect(next);
  return (
    <AuthCard title="Sign in to QFinera" subtitle="Your community, research and private pools in one place.">
      <LoginForm next={next} notice={sp.notice ? (NOTICES[sp.notice] ?? null) : null} />
    </AuthCard>
  );
}
