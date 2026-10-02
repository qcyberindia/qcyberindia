import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/qfinance/auth/AuthCard";
import { RegisterForm } from "@/components/qfinance/auth/AuthForms";
import { getQFinanceServerSession } from "@/lib/qfinance-community-auth";

export const metadata: Metadata = { title: "Create your account", robots: { index: false } };

export default async function RegisterPage() {
  if (await getQFinanceServerSession()) redirect("/qfinera/pools");
  return (
    <AuthCard title="Join QFinera" subtitle="One account for Learn, Community, Research and private Pools.">
      <RegisterForm />
    </AuthCard>
  );
}
