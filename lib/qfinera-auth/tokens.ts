// Random secrets for sessions, email verification and password reset. The
// raw value only ever travels to the user (cookie or email link); the
// database stores its SHA-256 hash, so a database leak exposes no usable token.
import { createHash, randomBytes } from "node:crypto";

export function newSecretToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecretToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** 32 random bytes in base64url are exactly 43 characters. */
export function isWellFormedSecretToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
