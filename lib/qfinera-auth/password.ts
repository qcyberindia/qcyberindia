// Password hashing for QFinera accounts. Pure (crypto only, no I/O).
//
// Algorithm: scrypt (memory-hard; built into Node, no native dependency).
// Argon2id would need a native npm module on the Node 22 runtime this
// project uses; scrypt at OWASP's recommended cost (N = 2^17, r = 8, p = 1)
// is the strongest maintained option available without one. Parameters are
// stored in every hash, so they can be raised later: needsRehash() flags old
// hashes and login transparently upgrades them.
//
// Format: scrypt$<log2 N>$<r>$<p>$<salt base64url>$<key base64url>
// Plaintext passwords are never stored or logged.
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const LOG2_N = 17;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

function derive(password: string, salt: Buffer, log2N: number, r: number, p: number): Promise<Buffer> {
  const N = 2 ** log2N;
  const options: ScryptOptions = { N, r, p, maxmem: 128 * N * r * 2 };
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt, LOG2_N, R, P);
  return `scrypt$${LOG2_N}$${R}$${P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

type Parsed = { log2N: number; r: number; p: number; salt: Buffer; key: Buffer };

function parse(stored: string): Parsed | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [log2N, r, p] = parts.slice(1, 4).map(Number);
  if (![log2N, r, p].every((n) => Number.isInteger(n) && n > 0) || log2N > 20 || r > 32 || p > 16) return null;
  const salt = Buffer.from(parts[4], "base64url");
  const key = Buffer.from(parts[5], "base64url");
  if (salt.length < 16 || key.length !== KEY_LENGTH) return null;
  return { log2N, r, p, salt, key };
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parsed = stored ? parse(stored) : null;
  if (!parsed) {
    await burnTime(password);
    return false;
  }
  const key = await derive(password, parsed.salt, parsed.log2N, parsed.r, parsed.p);
  return timingSafeEqual(key, parsed.key);
}

export function needsRehash(stored: string): boolean {
  const parsed = parse(stored);
  return !parsed || parsed.log2N < LOG2_N || parsed.r !== R || parsed.p !== P;
}

/**
 * Do the same work as a real verification, so "no such account" and "wrong
 * password" take the same time and cannot be told apart.
 */
export async function burnTime(password: string): Promise<void> {
  await derive(password, randomBytes(SALT_BYTES), LOG2_N, R, P);
}

const COMMON = new Set([
  "password12", "password123", "1234567890", "qwertyuiop", "iloveyou12", "qfinera123", "1q2w3e4r5t", "letmein123", "welcome123", "abcdefghij",
]);

/** NIST-style policy: length over composition rules. Returns a message, or null when acceptable. */
export function passwordProblem(password: string, context: { email?: string; displayName?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters.`;
  const lower = password.toLowerCase();
  if (new Set(lower).size < 4) return "That password is too repetitive.";
  if (COMMON.has(lower)) return "That password is too common.";
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "Don't use your email address in your password.";
  if (context.email && lower === context.email.toLowerCase()) return "Don't use your email address as your password.";
  return null;
}
