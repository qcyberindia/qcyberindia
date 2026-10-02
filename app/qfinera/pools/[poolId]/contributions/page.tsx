import type { Metadata } from "next";
import { ContributionsView } from "@/components/fund/views/ContributionsView";

export const metadata: Metadata = { title: "Contributions" };

export default function Page() {
  return <ContributionsView />;
}
