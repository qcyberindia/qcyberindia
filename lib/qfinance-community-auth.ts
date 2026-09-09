import crypto from "crypto";

// Passwordless magic-link auth for QFinance Community — no password is ever
// stored. Both the magic link and the resulting session are stateless,
// signed tokens (HMAC + expiry), not database rows. This mirrors
// lib/admin-auth.ts's approach but is a deliberately separate secret/cookie:
// the admin session and a community member's session must never be
// interchangeable.
//
// Token shape (before base64url-encoding): `${payloadJson}.${signature}`

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes to click the email link
export const SESSION_COOKIE = "qf_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string | undefined {
  return process.env.QFINANCE_AUTH_SECRET;
}

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function b64urlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function b64urlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

// ---------------------------------------------------------------------------
// Magic link tokens — email + expiry, signed. Sent as ?token= in the email.
// ---------------------------------------------------------------------------

export type MagicLinkPayload = { email: string; displayName: string; exp: number };

export function createMagicLinkToken(email: string, displayName: string): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const payload: MagicLinkPayload = {
    email: email.toLowerCase(),
    displayName,
    exp: Date.now() + MAGIC_LINK_TTL_MS,
  };
  const payloadStr = JSON.stringify(payload);
  const signature = sign(payloadStr, secret);
  return b64urlEncode(`${payloadStr}.${signature}`);
}

export function verifyMagicLinkToken(token: string): MagicLinkPayload | null {
  const secret = getSecret();
  if (!secret) return null;

  try {
    const decoded = b64urlDecode(token);
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;

    const payloadStr = decoded.slice(0, lastDot);
    const signature = decoded.slice(lastDot + 1);
    const expected = sign(payloadStr, secret);

    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return null;
    }

    const payload = JSON.parse(payloadStr) as MagicLinkPayload;
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Session tokens — userId + expiry, signed. Stored in the qf_session cookie.
// ---------------------------------------------------------------------------

export type SessionPayload = { userId: number; email: string; displayName: string; exp: number };

export function createSessionToken(user: { id: number; email: string; displayName: string }): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const payloadStr = JSON.stringify(payload);
  const signature = sign(payloadStr, secret);
  return b64urlEncode(`${payloadStr}.${signature}`);
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  const secret = getSecret();
  if (!secret || !token) return null;

  try {
    const decoded = b64urlDecode(token);
    const lastDot = decoded.lastIndexOf(".");
    if (lastDot === -1) return null;

    const payloadStr = decoded.slice(0, lastDot);
    const signature = decoded.slice(lastDot + 1);
    const expected = sign(payloadStr, secret);

    if (
      signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return null;
    }

    const payload = JSON.parse(payloadStr) as SessionPayload;
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

// Convenience for API routes: extract + verify the session cookie from a
// NextRequest in one call. Returns null if not signed in — callers should
// respond 401, never trust a client-supplied author/user id instead.
export function getQFinanceSessionFromRequest(req: {
  cookies: { get(name: string): { value: string } | undefined };
}): SessionPayload | null {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}
