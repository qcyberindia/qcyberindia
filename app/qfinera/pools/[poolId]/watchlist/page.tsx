import type { Metadata } from "next";
import { WatchlistView } from "@/components/fund/views/WatchlistView";

export const metadata: Metadata = { title: "Watchlist" };

export default function Page() {
  return <WatchlistView />;
}
