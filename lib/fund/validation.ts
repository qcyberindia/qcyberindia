// Server-side request validation for the QFinera Fund API. Hand-written
// (no schema library is installed) and deliberately strict:
//   - money, units, NAV and prices are accepted ONLY as decimal STRINGS,
//     never JSON numbers, so a value can never arrive already corrupted by
//     floating point;
//   - every parser throws a FundError("VALIDATION") naming the field.
import { Money } from "@/lib/accounting/money";
import { isValidIsoDate } from "@/lib/accounting/nav-cutoff";
import { validationError } from "@/lib/fund/errors";

const MAX_BODY_BYTES = 64 * 1024;

export type JsonObject = Record<string, unknown>;

export async function readJsonObject(req: Request): Promise<JsonObject> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw validationError("Request body is too large.");
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw validationError("Request body must be valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw validationError("Request body must be a JSON object.");
  }
  return parsed as JsonObject;
}

export function parseId(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d{1,9}$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 2_147_483_647) {
    throw validationError(`${label} is invalid.`, { [label]: "Invalid identifier" });
  }
  return n;
}

export function parseOptionalId(value: unknown, label: string): number | null {
  return value === undefined || value === null || value === "" ? null : parseId(value, label);
}

type DecimalOptions = { label: string; scale: 2 | 4; positive?: boolean; nonNegative?: boolean };

/** Plain, non-negative decimal string with at most `scale` places. */
export function parseDecimal(value: unknown, opts: DecimalOptions): Money {
  const field = opts.label;
  if (typeof value !== "string") {
    throw validationError(`${field} must be provided as a decimal string.`, { [field]: "Enter a number" });
  }
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw validationError(`${field} must be a plain positive number.`, { [field]: "Enter a number" });
  }
  const decimals = trimmed.split(".")[1]?.length ?? 0;
  if (decimals > opts.scale) {
    throw validationError(`${field} can have at most ${opts.scale} decimal places.`, {
      [field]: `At most ${opts.scale} decimal places`,
    });
  }
  if (trimmed.replace(".", "").length > 16) {
    throw validationError(`${field} is too large.`, { [field]: "Too large" });
  }
  const money = Money.fromDecimalString(trimmed);
  if (opts.positive && money.isZero()) {
    throw validationError(`${field} must be greater than zero.`, { [field]: "Must be greater than zero" });
  }
  return money;
}

export function parseOptionalDecimal(value: unknown, opts: DecimalOptions): Money | null {
  return value === undefined || value === null || value === "" ? null : parseDecimal(value, opts);
}

export function parseIsoDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !isValidIsoDate(value)) {
    throw validationError(`${label} must be a valid date (YYYY-MM-DD).`, { [label]: "Invalid date" });
  }
  return value;
}

export function parseOptionalIsoDate(value: unknown, label: string): string | null {
  return value === undefined || value === null || value === "" ? null : parseIsoDate(value, label);
}

export function parseText(value: unknown, label: string, opts: { max: number; min?: number }): string {
  if (typeof value !== "string") throw validationError(`${label} is required.`, { [label]: "Required" });
  const trimmed = value.trim();
  if (trimmed.length < (opts.min ?? 1)) throw validationError(`${label} is required.`, { [label]: "Required" });
  if (trimmed.length > opts.max) {
    throw validationError(`${label} must be ${opts.max} characters or fewer.`, { [label]: "Too long" });
  }
  return trimmed;
}

export function parseOptionalText(value: unknown, label: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw validationError(`${label} must be text.`, { [label]: "Invalid" });
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw validationError(`${label} must be ${max} characters or fewer.`, { [label]: "Too long" });
  return trimmed;
}

export function parseEnum<T extends string>(value: unknown, label: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw validationError(`${label} must be one of: ${allowed.join(", ")}.`, { [label]: "Invalid choice" });
  }
  return value as T;
}

export function parseEmail(value: unknown, label = "email"): string {
  const email = parseText(value, label, { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw validationError("Enter a valid email address.", { [label]: "Invalid email" });
  }
  return email;
}

export function parseBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw validationError(`${label} must be true or false.`, { [label]: "Invalid" });
  return value;
}

/** Only http(s) links are allowed for research references. */
export function parseOptionalUrl(value: unknown, label: string): string | null {
  const text = parseOptionalText(value, label, 500);
  if (text === null) return null;
  try {
    const u = new URL(text);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
    return u.toString();
  } catch {
    throw validationError(`${label} must be a valid http(s) link.`, { [label]: "Invalid link" });
  }
}

/** Pagination: bounded page size, 1-based page. */
export function parsePaging(params: URLSearchParams, defaults = { pageSize: 25, maxPageSize: 100 }) {
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const requested = Number.parseInt(params.get("pageSize") ?? String(defaults.pageSize), 10) || defaults.pageSize;
  const pageSize = Math.min(Math.max(1, requested), defaults.maxPageSize);
  return { page: Math.min(page, 10_000), pageSize, offset: (Math.min(page, 10_000) - 1) * pageSize };
}

/** Optional backdating request: { backdateReason, confirmBackdate: true }. */
export function parseBackdate(body: JsonObject): { reason: string | null; confirmed: boolean } | null {
  const reason = parseOptionalText(body.backdateReason, "backdateReason", 500);
  const confirmed = body.confirmBackdate === true;
  return reason || confirmed ? { reason, confirmed } : null;
}

/** Optional 24-hour "HH:MM". */
export function parseOptionalTime(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw validationError(`${label} must be a 24-hour time (HH:MM).`, { [label]: "Use HH:MM" });
  }
  return value;
}
