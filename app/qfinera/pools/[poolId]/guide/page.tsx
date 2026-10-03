import type { Metadata } from "next";
import { GuideView } from "@/components/fund/views/GuideView";

export const metadata: Metadata = { title: "Guide" };

export default function Page() {
  return <GuideView />;
}
