// Client-side, localStorage-only chapter progress (Section 9 — no backend/
// accounts yet). Never blocks access to any chapter; purely a "you've been
// here" visual cue on the timeline.
const KEY = "qf-progress";
const EVENT = "qf-progress-updated";

// A stable empty-array reference, reused any time there's genuinely no
// progress to report (SSR, empty storage, parse failure). Returning a fresh
// `[]` literal on every call would break useSyncExternalStore's requirement
// that getSnapshot return a referentially stable value when nothing changed.
const EMPTY_SLUGS: string[] = [];

let cachedRaw: string | null | undefined = undefined;
let cachedSlugs: string[] = EMPTY_SLUGS;

export function getVisitedSlugs(): string[] {
  if (typeof window === "undefined") return EMPTY_SLUGS;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY_SLUGS;
  }

  if (raw === cachedRaw) return cachedSlugs; // unchanged since last read — same reference

  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    cachedSlugs = Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : EMPTY_SLUGS;
  } catch {
    cachedSlugs = EMPTY_SLUGS;
  }
  return cachedSlugs;
}

/** Always returns the same stable reference — for useSyncExternalStore's `getServerSnapshot`. */
export function getServerVisitedSlugs(): string[] {
  return EMPTY_SLUGS;
}

/** Subscribe to progress changes — for useSyncExternalStore's `subscribe`. */
export function subscribeToProgress(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback); // cross-tab
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function markVisited(slug: string) {
  if (typeof window === "undefined") return;
  try {
    const current = getVisitedSlugs();
    if (current.includes(slug)) return; // no change — skip write + notify
    const next = [...current, slug];
    window.localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // localStorage unavailable — progress just won't persist.
  }
}
