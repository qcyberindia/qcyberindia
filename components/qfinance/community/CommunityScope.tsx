"use client";

import { ReactNode } from "react";
import { CommunityAuthProvider } from "./CommunityAuthContext";

/** Wraps a single CommunityAuthProvider around everything on the post page
 * that needs identity (the reply form + every reply's report button), so
 * they share one session fetch instead of each firing their own. */
export default function CommunityScope({ children }: { children: ReactNode }) {
  return <CommunityAuthProvider>{children}</CommunityAuthProvider>;
}
