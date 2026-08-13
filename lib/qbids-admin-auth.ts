import crypto from "crypto";

// Simple password-gated cookie session — appropriate for a small internal
// beta-management tool, not a full auth system. The cookie is
// "<timestamp>.<hmac(timestamp)>" so it can't be forged without knowing
// QBIDS_ADMIN_PASSWORD, and it expires both via maxAge and a server-side
// timestamp check.
export const QBIDS_ADMIN_COOKIE = "qbids_admin";
export const QBIDS_ADMIN_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function createAdminCookieValue(secret: string): string {
  const timestamp = String(Date.now());
  return `${timestamp}.${sign(timestamp, secret)}`;
}

export function isValidAdminCookie(cookieValue: string | undefined): boolean {
  const secret = process.env.QBIDS_ADMIN_PASSWORD;
  if (!secret || !cookieValue) return false;

  const [timestamp, signature] = cookieValue.split(".");
  if (!timestamp || !signature) return false;

  const age = Date.now() - Number(timestamp);
  if (Number.isNaN(age) || age < 0 || age > QBIDS_ADMIN_MAX_AGE_SECONDS * 1000) return false;

  const expected = sign(timestamp, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false; // length mismatch etc.
  }
}
