import type { Metadata } from "next";
import { ReportsView } from "@/components/fund/views/ReportsView";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  return <ReportsView />;
}
