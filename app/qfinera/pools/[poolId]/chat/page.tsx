import type { Metadata } from "next";
import { ChatView } from "@/components/fund/views/ChatView";

export const metadata: Metadata = { title: "Pool Chat" };

export default function Page() {
  return <ChatView />;
}
