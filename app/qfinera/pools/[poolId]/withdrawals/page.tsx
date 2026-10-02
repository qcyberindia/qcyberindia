import type { Metadata } from "next";
import { WithdrawalsView } from "@/components/fund/views/WithdrawalsView";

export const metadata: Metadata = { title: "Withdrawals" };

export default function Page() {
  return <WithdrawalsView />;
}
