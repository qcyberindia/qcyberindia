import type { Metadata } from "next";
import { MembersView } from "@/components/fund/views/MembersView";

export const metadata: Metadata = { title: "Members" };

export default function Page() {
  return <MembersView />;
}
