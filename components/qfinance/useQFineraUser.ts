"use client";

// Who is signed in, for navigation only (never an authorization decision:
// every protected page and API checks the session on the server). One
// request per page load, shared by the header and the mobile tab bar.
import { useEffect, useState } from "react";

export type NavUser = { id: number; displayName: string } | null;

let pending: Promise<NavUser> | null = null;

function load(): Promise<NavUser> {
  pending ??= fetch("/api/qfinera/auth/session", { credentials: "same-origin", cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j?.ok ? (j.user as NavUser) : null))
    .catch(() => null);
  return pending;
}

/** Forget the cached answer (after sign-in / sign-out). */
export function resetQFineraUser(): void {
  pending = null;
}

export function useQFineraUser(): { user: NavUser; known: boolean } {
  const [state, setState] = useState<{ user: NavUser; known: boolean }>({ user: null, known: false });
  useEffect(() => {
    let alive = true;
    load().then((user) => alive && setState({ user, known: true }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
