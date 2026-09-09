"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type CommunityUser = { id: number; email: string; displayName: string };

type CommunityAuthState = {
  user: CommunityUser | null;
  checking: boolean;
  refresh: () => void;
  signOut: () => Promise<void>;
};

const CommunityAuthContext = createContext<CommunityAuthState | null>(null);

/** Scoped to the Community pages only (not the whole QFinance layout) —
 * nothing else in QFinance needs to know whether someone is signed in. */
export function CommunityAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CommunityUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [token, setToken] = useState(0);

  useEffect(() => {
    fetch("/api/qfinance/community/auth/session")
      .then((res) => res.json())
      .then((json) => setUser(json.ok ? json.user : null))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, [token]);

  async function signOut() {
    await fetch("/api/qfinance/community/auth/session", { method: "DELETE" });
    setUser(null);
  }

  return (
    <CommunityAuthContext.Provider value={{ user, checking, refresh: () => setToken((t) => t + 1), signOut }}>
      {children}
    </CommunityAuthContext.Provider>
  );
}

export function useCommunityAuth() {
  const ctx = useContext(CommunityAuthContext);
  if (!ctx) throw new Error("useCommunityAuth must be used within CommunityAuthProvider");
  return ctx;
}
