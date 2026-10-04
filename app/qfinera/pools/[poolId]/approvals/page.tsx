import type { Metadata } from "next";
import { ApprovalsView } from "@/components/fund/views/ApprovalsView";

export const metadata: Metadata = { title: "Approvals" };

export default function Page() {
  return <ApprovalsView />;
}
