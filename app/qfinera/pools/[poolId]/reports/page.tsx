import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportsView } from "@/components/fund/views/ReportsView";

export const metadata: Metadata = { title: "Reports" };

export default function Page() {
  // ReportsView reads ?date= (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense>
      <ReportsView />
    </Suspense>
  );
}
