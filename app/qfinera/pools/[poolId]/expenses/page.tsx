import type { Metadata } from "next";
import { ExpensesView } from "@/components/fund/views/ExpensesView";

export const metadata: Metadata = { title: "Expenses" };

export default function Page() {
  return <ExpensesView />;
}
