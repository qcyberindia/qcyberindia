"use client";

import { useSyncExternalStore } from "react";
import { qfinanceRelativeTime, qfinanceAbsoluteDateUTC } from "@/lib/qfinance-time";

// No live updates needed (the label just needs to be correct at render
// time, not tick every minute) — an empty subscription is valid for
// useSyncExternalStore; React still guarantees the getServerSnapshot →
// getSnapshot transition described below.
function subscribe() {
  return () => {};
}

/**
 * Renders a timestamp using calendar-day-aware relative time, computed in
 * the viewer's own local timezone — never the server's.
 *
 * Hydration safety: useSyncExternalStore is the tool React provides
 * specifically for a value that legitimately differs between server and
 * client (an "external system" here being the browser's own clock/
 * timezone). React renders with `getServerSnapshot` for both the SSR pass
 * and the client's first hydration pass — guaranteed identical, so no
 * mismatch — then switches to `getSnapshot` (the real, local-timezone
 * relative time) immediately after. This replaces an earlier
 * useState+useEffect version that called setState directly and
 * unconditionally as the entire effect body, which is exactly the pattern
 * react-hooks/set-state-in-effect exists to catch; useSyncExternalStore
 * sidesteps the problem at the root rather than working around the rule.
 */
export default function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => qfinanceRelativeTime(iso), // client snapshot: real Date.now() + local timezone
    () => qfinanceAbsoluteDateUTC(iso) // server snapshot: timezone-independent, used for SSR + first client paint
  );

  return (
    <span className={className} suppressHydrationWarning>
      {label}
    </span>
  );
}
