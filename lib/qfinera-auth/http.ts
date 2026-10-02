// Reading the signed-in QFinera user in Route Handlers and Server Components.
// The session is looked up in the database on every call (no trust in the
// cookie beyond being a random lookup key).
import { cookies } from "next/headers";
import { readDb } from "@/lib/fund/db";
import { unauthenticatedError } from "@/lib/fund/errors";
import { SESSION_COOKIE, getSession, type AuthSession } from "@/lib/qfinera-auth/sessions";

type CookieReader = { cookies: { get(name: string): { value: string } | undefined } };

async function lookup(token: string | undefined): Promise<AuthSession | null> {
  if (!token) return null;
  try {
    return await getSession(readDb(), token);
  } catch (err) {
    // No database configured / unreachable: treat as signed out, never as signed in.
    console.error("QFinera: session lookup failed:", err);
    return null;
  }
}

export function sessionTokenFrom(req: CookieReader): string | undefined {
  return req.cookies.get(SESSION_COOKIE)?.value;
}

export async function getRequestSession(req: CookieReader): Promise<AuthSession | null> {
  return lookup(sessionTokenFrom(req));
}

export async function requireRequestSession(req: CookieReader): Promise<AuthSession> {
  const s = await getRequestSession(req);
  if (!s) throw unauthenticatedError();
  return s;
}

/** Server Components / pages. */
export async function getServerSession(): Promise<AuthSession | null> {
  return lookup((await cookies()).get(SESSION_COOKIE)?.value);
}
