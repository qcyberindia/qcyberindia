import crypto from "crypto";

// The one, centralized QCyberIndia Admin authentication mechanism. Every
// admin surface - Overview, Qbids, QFinance, and the legacy /qbids/admin
// redirect - shares this single password, cookie, and session. There is
// no product-specific login: Qbids and QFinance are separate *data*
// domains (separate tables, separate registration flows), but they are
// not separate *authentication* domains.
//
// Historically this password/cookie were Qbids-specific
// (QBIDS_ADMIN_PASSWORD / "qbids_admin", in what's now lib/qbids-admin-auth.ts,
// archived at /_archive/qcyberindia-admin-auth-legacy/). That file's logic
// now lives here, under a name that reflects what it actually is.
export const ADMIN_COOKIE = "qcyberindia_admin";
export const ADMIN_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function getAdminSecret(): string | undefined {
  return process.env.QCYBERINDIA_ADMIN_PASSWORD;
}

export function createAdminCookieValue(secret: string): string {
  const timestamp = String(Date.now());
  return `${timestamp}.${sign(timestamp, secret)}`;
}

export function isValidAdminCookie(cookieValue: string | undefined): boolean {
  const secret = getAdminSecret();
  if (!secret || !cookieValue) return false;

  const [timestamp, signature] = cookieValue.split(".");
  if (!timestamp || !signature) return false;

  const age = Date.now() - Number(timestamp);
  if (Number.isNaN(age) || age < 0 || age > ADMIN_MAX_AGE_SECONDS * 1000) return false;

  const expected = sign(timestamp, secret);
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false; // length mismatch etc.
  }
}
