// "Next applicable EOD NAV" rule for QFinera Fund. Pure; no I/O.
//
// Rule (docs/qfinera-fund/ACCOUNTING_RULES.md, section 3a):
//   - All times are IST (UTC+05:30, no daylight saving).
//   - The cutoff event is `funds_confirmed_at` for a contribution and
//     `approved_at` for a withdrawal.
//   - Default cutoff 16:00 IST, configurable per fund.
//   - Event at or before the cutoff on a TRADING day -> that day's EOD NAV.
//   - Otherwise -> the next trading day's EOD NAV.
//   - Trading day = Monday to Friday and not a configured market holiday.
//
// The comparison is made on milliseconds-of-day, so 16:00:00.001 is AFTER
// a 16:00 cutoff.

export type NavCutoffConfig = {
  /** "HH:MM", 24-hour, IST. */
  cutoffTimeIst: string;
  /** ISO dates (YYYY-MM-DD) on which the market is closed. */
  holidays: readonly string[];
};

export const DEFAULT_NAV_CUTOFF: NavCutoffConfig = { cutoffTimeIst: "16:00", holidays: [] };

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const DAY_MS = 86_400_000;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isoToUtcMs(iso: string): number {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new Error(`"${iso}" is not an ISO date (YYYY-MM-DD)`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== iso) {
    throw new Error(`"${iso}" is not a valid calendar date`);
  }
  return ms;
}

export function isValidIsoDate(iso: string): boolean {
  try {
    isoToUtcMs(iso);
    return true;
  } catch {
    return false;
  }
}

/** Minutes after midnight for an "HH:MM" cutoff. Throws on bad input. */
export function parseCutoffMinutes(hhmm: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) throw new Error(`cutoff time "${hhmm}" must be HH:MM (24-hour)`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** The IST calendar date and elapsed milliseconds-of-day for an instant. */
export function toIstParts(instant: Date): { date: string; msOfDay: number } {
  const shifted = instant.getTime() + IST_OFFSET_MS;
  const dayStart = Math.floor(shifted / DAY_MS) * DAY_MS;
  return {
    date: new Date(dayStart).toISOString().slice(0, 10),
    msOfDay: shifted - dayStart,
  };
}

export function addDays(iso: string, days: number): string {
  return new Date(isoToUtcMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso` (positive when `toIso` is later). */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((isoToUtcMs(toIso) - isoToUtcMs(fromIso)) / DAY_MS);
}

export function isTradingDay(iso: string, holidays: readonly string[]): boolean {
  const dow = new Date(isoToUtcMs(iso)).getUTCDay(); // 0 = Sunday, 6 = Saturday
  if (dow === 0 || dow === 6) return false;
  return !holidays.includes(iso);
}

/** The first trading day strictly after `iso`. */
export function nextTradingDay(iso: string, holidays: readonly string[]): string {
  let candidate = iso;
  for (let i = 0; i < 400; i++) {
    candidate = addDays(candidate, 1);
    if (isTradingDay(candidate, holidays)) return candidate;
  }
  throw new Error("no trading day found within 400 days; check the configured holidays");
}

/** The IST date whose official EOD NAV applies to an event at `eventAt`. */
export function applicableNavDate(eventAt: Date, config: NavCutoffConfig = DEFAULT_NAV_CUTOFF): string {
  const cutoffMs = parseCutoffMinutes(config.cutoffTimeIst) * 60_000;
  const { date, msOfDay } = toIstParts(eventAt);
  if (isTradingDay(date, config.holidays) && msOfDay <= cutoffMs) return date;
  return nextTradingDay(date, config.holidays);
}

/** The instant (UTC) at which the cutoff passes on an IST date. */
export function cutoffInstant(isoDate: string, config: NavCutoffConfig = DEFAULT_NAV_CUTOFF): Date {
  const cutoffMs = parseCutoffMinutes(config.cutoffTimeIst) * 60_000;
  return new Date(isoToUtcMs(isoDate) + cutoffMs - IST_OFFSET_MS);
}

/** Validates a stored nav_settings JSON blob, falling back to defaults. */
export function parseNavCutoffConfig(raw: unknown): NavCutoffConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_NAV_CUTOFF;
  const obj = raw as Record<string, unknown>;
  const time = typeof obj.cutoff_time_ist === "string" ? obj.cutoff_time_ist : DEFAULT_NAV_CUTOFF.cutoffTimeIst;
  try {
    parseCutoffMinutes(time);
  } catch {
    return DEFAULT_NAV_CUTOFF;
  }
  const holidays = Array.isArray(obj.holidays)
    ? obj.holidays.filter((h): h is string => typeof h === "string" && isValidIsoDate(h))
    : [];
  return { cutoffTimeIst: time, holidays };
}
