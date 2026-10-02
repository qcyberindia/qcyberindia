import type { Metadata } from "next";
import { TradesView } from "@/components/fund/views/TradesView";

export const metadata: Metadata = { title: "Trades" };

const STATUSES = ["DRAFT", "EXECUTED", "SETTLED", "CANCELLED", "REVERSED"];

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const raw = (await searchParams).status;
  const status = typeof raw === "string" && STATUSES.includes(raw) ? raw : "";
  return <TradesView initialStatus={status} />;
}
