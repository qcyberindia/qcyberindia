/**
 * Shared QFinera relative-time formatting. Two rules, matched to how people
 * actually read timestamps:
 *
 *  - Under 24 hours old: pure elapsed time ("3 minutes ago", "5 hours ago").
 *  - 24 hours or older: compared by LOCAL CALENDAR DAY, not by dividing
 *    elapsed milliseconds into fixed 24-hour blocks. That was the bug this
 *    replaces — `Math.floor(elapsedMs / 86_400_000)` counts 24-hour periods
 *    since the exact timestamp, not calendar days crossed, so two posts
 *    that are both genuinely "2 days old" could disagree (one showing
 *    "Today", one "Yesterday") purely based on what time of day each was
 *    originally posted, relative to whatever moment they happened to be
 *    viewed. Comparing calendar-day start times instead makes this
 *    deterministic and matches what a person actually means by "Today" /
 *    "Yesterday".
 *
 * Must only be called client-side (inside a "use client" component, after
 * mount) — "today" and calendar-day boundaries are meaningless without the
 * viewer's own timezone, which a Server Component render doesn't have.
 */
export function qfinanceRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();

  if (diffMs < 0) return "Just now"; // clock skew guard
  if (diffMs < 60_000) return "Just now";
  if (diffMs < 3_600_000) {
    const m = Math.floor(diffMs / 60_000);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diffMs < 86_400_000) {
    const h = Math.floor(diffMs / 3_600_000);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }

  const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfLocalDay(now) - startOfLocalDay(then)) / 86_400_000);

  if (dayDiff <= 0) return "Today"; // same local calendar day, just >24h of month-boundary edge cases
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 30) return `${dayDiff} days ago`;

  return qfinanceAbsoluteDate(iso);
}

/** Absolute date in the viewer's local timezone — used client-side for
 * content old enough that a relative label stops being useful. */
export function qfinanceAbsoluteDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Timezone-pinned (UTC) absolute date — deliberately timezone-independent
 * so it produces byte-identical output wherever it runs (server render,
 * or a client's first paint before any effect runs). This is the only
 * safe thing to render before we know the viewer's timezone; a relative
 * label always depends on "now" and the viewer's local calendar day, so
 * it can only be computed after mount. */
export function qfinanceAbsoluteDateUTC(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
