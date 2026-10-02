"use client";

// Client-side view of "who am I in this pool". Built on the server from the
// verified session + membership (app/qfinera/pools/[poolId]/layout.tsx) and
// handed down as plain data. It drives what the UI SHOWS; it is never an
// authorization decision (the API re-checks every request).
import { createContext, useCallback, useContext, useMemo } from "react";
import type { FundRole } from "@/lib/fund/rbac";
import type { UiPermission } from "@/components/fund/permissions";

export type FundSession = {
  userId: number;
  displayName: string;
  role: FundRole;
  poolId: number;
  poolName: string;
  poolStatus: string;
  pools: Array<{ id: number; name: string; role: FundRole }>;
  permissions: UiPermission[];
};

const SessionContext = createContext<FundSession | null>(null);

export function FundSessionProvider({ value, children }: { value: FundSession; children: React.ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useFund(): FundSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useFund must be used inside <FundSessionProvider>");
  return session;
}

/** `can("contributions:approve")` - presentation-only permission check. */
export function useCan(): (permission: UiPermission) => boolean {
  const { permissions } = useFund();
  const set = useMemo(() => new Set<UiPermission>(permissions), [permissions]);
  return useCallback((permission: UiPermission) => set.has(permission), [set]);
}
