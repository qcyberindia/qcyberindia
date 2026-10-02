import type { Metadata } from "next";
import { HoldingsView } from "@/components/fund/views/HoldingsView";

export const metadata: Metadata = { title: "Holdings" };

export default function Page() {
  return <HoldingsView />;
}
