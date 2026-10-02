// QFinera password authentication against a real database, through the
// actual route handlers: registration (no enumeration, squatting-proof
// verification), sign-in, server-side sessions, brute-force protection,
// sign-out revocation, expiry, password reset and change, suspension, and
// the QCyberIndia admin user tools. Opt-in: see harness.ts.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDatabase, createUser, integrationEnabled, json, params, request, type TestDb } from "./harness";
import { NextRequest } from "next/server";

import * as registerRoute from "@/app/api/qfinera/auth/register/route";
import * as verifyRoute from "@/app/api/qfinera/auth/verify-email/route";
import * as loginRoute from "@/app/api/qfinera/auth/login/route";
import * as logoutRoute from "@/app/api/qfinera/auth/logout/route";
import * as forgotRoute from "@/app/api/qfinera/auth/forgot-password/route";
import * as resetRoute from "@/app/api/qfinera/auth/reset-password/route";
import * as sessionRoute from "@/app/api/qfinera/auth/session/route";
import * as accountRoute from "@/app/api/qfinera/account/route";
import * as passwordRoute from "@/app/api/qfinera/account/password/route";
import * as sessionsRoute from "@/app/api/qfinera/account/sessions/route";
import * as adminUsersRoute from "@/app/api/admin/qfinance/users/route";
import * as adminUserRoute from "@/app/api/admin/qfinance/users/[id]/route";
import * as legacyRequest from "@/app/api/qfinance/community/auth/request/route";
import * as communitySession from "@/app/api/qfinance/community/auth/session/route";
import { ADMIN_COOKIE, createAdminCookieValue } from "@/lib/admin-auth";

const suite = integrationEnabled ? describe : describe.skip;

type Cookie = { name: string; value: string };

function cookieFrom(res: Response): Cookie | null {
  const raw = res.headers.get("set-cookie");
  const m = raw ? /qf_sid=([^;]*)/.exec(raw) : null;
  return m ? { name: "qf_sid", value: m[1] } : null;
}

function req(path: string, body?: unknown, opts: { cookie?: string; ip?: string; method?: string } = {}) {
  const headers: Record<string, string> = { host: "localhost:3000", "x-forwarded-for": opts.ip ?? "10.0.0.1" };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(`http://localhost:3000${path}`, {
    method: opts.method ?? (body === undefined ? "GET" : "POST"),
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

suite("QFinera password authentication (real database)", () => {
  let db: TestDb;
  const links: string[] = [];
  const PASSWORD = "correct horse battery";

  const lastLink = (kind: "verify-email" | "reset-password") => {
    const l = [...links].reverse().find((x) => x.includes(`/qfinera/${kind}?token=`));
    if (!l) throw new Error(`no ${kind} link captured`);
    return new URL(l).searchParams.get("token") as string;
  };

  async function registerAndVerify(email: string, password = PASSWORD, name = "Test User") {
    const r = await registerRoute.POST(req("/api/qfinera/auth/register", { displayName: name, email, password, confirmPassword: password, acceptTerms: true }, { ip: `10.1.${links.length}.1` }));
    expect(r.status).toBe(202);
    const res = await verifyRoute.POST(req("/api/qfinera/auth/verify-email", { token: lastLink("verify-email"), password }));
    expect(res.status).toBe(200);
    return cookieFrom(res) as Cookie;
  }

  const cookieHeader = (c: Cookie) => `${c.name}=${c.value}`;

  beforeAll(async () => {
    db = await createTestDatabase();
    process.env.QCYBERINDIA_ADMIN_PASSWORD = "admin-test-password";
  }, 60_000);

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      const m = /Development link for [^:]+: (\S+)/.exec(String(args[0]));
      if (m) links.push(m[1]);
    });
  });

  afterAll(async () => {
    await db?.close();
  });

  it("registration validates input server-side", async () => {
    const base = { displayName: "Asha", email: "asha@example.test", password: PASSWORD, confirmPassword: PASSWORD, acceptTerms: true };
    for (const bad of [
      { ...base, password: "short", confirmPassword: "short" },
      { ...base, confirmPassword: "different password" },
      { ...base, acceptTerms: false },
      { ...base, email: "not-an-email" },
      { ...base, password: "aaaaaaaaaaaa", confirmPassword: "aaaaaaaaaaaa" },
      { ...base, displayName: "" },
    ]) {
      expect((await registerRoute.POST(req("/api/qfinera/auth/register", bad, { ip: "10.9.9.9" }))).status, JSON.stringify(bad)).toBe(400);
    }
  });

  it("registers without storing a password until the email is confirmed; never plaintext", async () => {
    const r = await json(await registerRoute.POST(req("/api/qfinera/auth/register", { displayName: "Asha", email: "Asha@Example.test", password: PASSWORD, confirmPassword: PASSWORD, acceptTerms: true })));
    expect(r.status).toBe(202);
    const { rows } = await db.query("SELECT email, password_hash, email_verified_at FROM qfinance_users WHERE email = 'asha@example.test'");
    expect(rows[0]).toEqual({ email: "asha@example.test", password_hash: null, email_verified_at: null });
    const tok = await db.query("SELECT pending_password_hash FROM qfinance_auth_tokens WHERE purpose = 'EMAIL_VERIFY'");
    expect(tok.rows[0].pending_password_hash).toMatch(/^scrypt\$17\$8\$1\$/);
    expect(JSON.stringify(tok.rows)).not.toContain(PASSWORD);

    // Not verified yet: sign-in fails exactly like a wrong password.
    const early = await json(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: PASSWORD })));
    expect(early.status).toBe(401);
    expect(early.body.error.message).toBe("Email or password is incorrect.");
  });

  it("verification needs the password chosen at registration, then signs in", async () => {
    const token = lastLink("verify-email");
    const wrong = await verifyRoute.POST(req("/api/qfinera/auth/verify-email", { token, password: "someone elses password" }));
    expect(wrong.status).toBe(401);
    const ok = await verifyRoute.POST(req("/api/qfinera/auth/verify-email", { token, password: PASSWORD }));
    expect(ok.status).toBe(200);
    const cookie = cookieFrom(ok) as Cookie;
    expect(cookie.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const setCookie = ok.headers.get("set-cookie") ?? "";
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Path=\//);
    expect(setCookie).not.toContain("asha"); // no personal data in the cookie

    const again = await verifyRoute.POST(req("/api/qfinera/auth/verify-email", { token, password: PASSWORD }));
    expect(again.status).toBe(404); // single use

    const s = await json(await sessionRoute.GET(req("/api/qfinera/auth/session", undefined, { cookie: cookieHeader(cookie) })));
    expect(s.body.user.displayName).toBe("Asha");
    const stored = await db.query("SELECT token_hash, expires_at - created_at AS ttl FROM qfinance_sessions ORDER BY id DESC LIMIT 1");
    expect(stored.rows[0].token_hash).not.toBe(cookie.value);
    expect(stored.rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(String((stored.rows[0].ttl as { days: number }).days)).toBe("30");
  });

  it("registering an existing email gives the same response and changes nothing", async () => {
    const before = await db.query("SELECT password_hash FROM qfinance_users WHERE email = 'asha@example.test'");
    const r = await json(await registerRoute.POST(req("/api/qfinera/auth/register", { displayName: "Imposter", email: "asha@example.test", password: "another long password", confirmPassword: "another long password", acceptTerms: true }, { ip: "10.2.2.2" })));
    expect(r.status).toBe(202);
    expect(r.body.data.message).toBe("Check your email for a link to confirm your account.");
    const after = await db.query("SELECT password_hash, display_name FROM qfinance_users WHERE email = 'asha@example.test'");
    expect(after.rows[0]).toEqual({ password_hash: before.rows[0].password_hash, display_name: "Asha" });
  });

  it("a squatter who pre-registers someone's email cannot take the account", async () => {
    // Attacker registers victim's address with the attacker's password.
    await registerRoute.POST(req("/api/qfinera/auth/register", { displayName: "Victim?", email: "victim@example.test", password: "attacker secret pw", confirmPassword: "attacker secret pw", acceptTerms: true }, { ip: "10.3.3.3" }));
    const attackerLink = lastLink("verify-email");
    // The victim registers for real; their link supersedes the attacker's.
    await registerRoute.POST(req("/api/qfinera/auth/register", { displayName: "Victim", email: "victim@example.test", password: "my own secret phrase", confirmPassword: "my own secret phrase", acceptTerms: true }, { ip: "10.4.4.4" }));
    const victimLink = lastLink("verify-email");
    expect((await verifyRoute.POST(req("/api/qfinera/auth/verify-email", { token: attackerLink, password: "attacker secret pw" }))).status).toBe(404);
    // Even the victim's own link only works with the victim's password.
    expect((await verifyRoute.POST(req("/api/qfinera/auth/verify-email", { token: victimLink, password: "attacker secret pw" }))).status).toBe(401);
    expect((await verifyRoute.POST(req("/api/qfinera/auth/verify-email", { token: victimLink, password: "my own secret phrase" }))).status).toBe(200);
  });

  it("sign-in: generic error for a wrong password and for an unknown email alike", async () => {
    const wrong = await json(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: "wrong password!" })));
    const unknown = await json(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "nobody@example.test", password: "wrong password!" })));
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("sign-in issues a fresh session and retires the one presented (session fixation)", async () => {
    const first = cookieFrom(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: PASSWORD }))) as Cookie;
    const second = cookieFrom(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: PASSWORD }, { cookie: cookieHeader(first) }))) as Cookie;
    expect(second.value).not.toBe(first.value);
    expect((await sessionRoute.GET(req("/api/qfinera/auth/session", undefined, { cookie: cookieHeader(first) }))).status).toBe(401);
    expect((await sessionRoute.GET(req("/api/qfinera/auth/session", undefined, { cookie: cookieHeader(second) }))).status).toBe(200);
  });

  it("logout revokes the session on the server, not just the cookie", async () => {
    const c = cookieFrom(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: PASSWORD }))) as Cookie;
    const out = await logoutRoute.POST(req("/api/qfinera/auth/logout", {}, { cookie: cookieHeader(c) }));
    expect(out.headers.get("set-cookie")).toMatch(/qf_sid=;/);
    expect((await sessionRoute.GET(req("/api/qfinera/auth/session", undefined, { cookie: cookieHeader(c) }))).status).toBe(401);
  });

  it("sessions expire after 30 days on the server", async () => {
    const c = cookieFrom(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: PASSWORD }))) as Cookie;
    expect((await sessionRoute.GET(req("/api/qfinera/auth/session", undefined, { cookie: cookieHeader(c) }))).status).toBe(200);
    await db.query("UPDATE qfinance_sessions SET created_at = now() - interval '31 days', expires_at = now() - interval '1 day' WHERE revoked_at IS NULL");
    expect((await sessionRoute.GET(req("/api/qfinera/auth/session", undefined, { cookie: cookieHeader(c) }))).status).toBe(401);
  });

  it("brute force: repeated failures lock the account's sign-in for a while, even with the right password", async () => {
    await registerAndVerify("bruce@example.test");
    for (let i = 0; i < 8; i++) {
      expect((await loginRoute.POST(req("/api/qfinera/auth/login", { email: "bruce@example.test", password: `guess number ${i}` }, { ip: `10.5.${i}.1` }))).status).toBe(401);
    }
    const locked = await json(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "bruce@example.test", password: PASSWORD }, { ip: "10.6.0.1" })));
    expect(locked.status).toBe(429);
  }, 30_000);

  it("forgot password: same answer for known and unknown emails; only known ones get a link", async () => {
    const before = links.length;
    const a = await json(await forgotRoute.POST(req("/api/qfinera/auth/forgot-password", { email: "nobody@example.test" }, { ip: "10.7.0.1" })));
    expect(links.length).toBe(before);
    const b = await json(await forgotRoute.POST(req("/api/qfinera/auth/forgot-password", { email: "asha@example.test" }, { ip: "10.7.0.2" })));
    expect(a).toEqual(b);
    expect(links.length).toBe(before + 1);
  });

  it("reset: single use, signs out every session, old password stops working", async () => {
    const live = cookieFrom(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: PASSWORD }))) as Cookie;
    const token = lastLink("reset-password");
    const NEW = "a brand new passphrase";
    const weak = await resetRoute.POST(req("/api/qfinera/auth/reset-password", { token, password: "short", confirmPassword: "short" }));
    expect(weak.status).toBe(400);
    const ok = await resetRoute.POST(req("/api/qfinera/auth/reset-password", { token, password: NEW, confirmPassword: NEW }));
    expect(ok.status).toBe(200);
    expect((await resetRoute.POST(req("/api/qfinera/auth/reset-password", { token, password: NEW, confirmPassword: NEW }))).status).toBe(404);
    expect((await sessionRoute.GET(req("/api/qfinera/auth/session", undefined, { cookie: cookieHeader(live) }))).status).toBe(401);
    expect((await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: PASSWORD }))).status).toBe(401);
    expect((await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: NEW }))).status).toBe(200);
  });

  it("existing email-link accounts keep their identity and set a password through reset", async () => {
    const { rows } = await db.query("INSERT INTO qfinance_users (email, display_name) VALUES ('legacy@example.test', 'Legacy Member') RETURNING id");
    const legacyId = rows[0].id;
    await forgotRoute.POST(req("/api/qfinera/auth/forgot-password", { email: "legacy@example.test" }, { ip: "10.8.0.1" }));
    const pw = "remembered phrase 42";
    expect((await resetRoute.POST(req("/api/qfinera/auth/reset-password", { token: lastLink("reset-password"), password: pw, confirmPassword: pw }))).status).toBe(200);
    const c = cookieFrom(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "legacy@example.test", password: pw }))) as Cookie;
    const me = await json(await accountRoute.GET(req("/api/qfinera/account", undefined, { cookie: cookieHeader(c) })));
    expect(me.body.data.account.userId).toBe(legacyId);
    const count = await db.query("SELECT COUNT(*)::int AS n FROM qfinance_users WHERE lower(email) = 'legacy@example.test'");
    expect(count.rows[0].n).toBe(1);
  });

  it("old magic-link sign-in is retired, and old stateless cookies are not accepted", async () => {
    expect((await legacyRequest.POST()).status).toBe(410);
    const old = await communitySession.GET(req("/api/qfinance/community/auth/session", undefined, { cookie: "qf_session=eyJ1c2VySWQiOjF9.abc" }));
    expect(old.status).toBe(401);
  });

  it("change password needs the current one, rotates this session and signs out the others", async () => {
    const NEW = "a brand new passphrase";
    const a = cookieFrom(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: NEW }))) as Cookie;
    const b = cookieFrom(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: NEW }))) as Cookie;
    const wrong = await passwordRoute.POST(req("/api/qfinera/account/password", { currentPassword: "not it at all", password: "third passphrase here", confirmPassword: "third passphrase here" }, { cookie: cookieHeader(a) }));
    expect(wrong.status).toBe(401);
    const ok = await passwordRoute.POST(req("/api/qfinera/account/password", { currentPassword: NEW, password: "third passphrase here", confirmPassword: "third passphrase here" }, { cookie: cookieHeader(a) }));
    expect(ok.status).toBe(200);
    const rotated = cookieFrom(ok) as Cookie;
    expect(rotated.value).not.toBe(a.value);
    for (const old of [a, b]) expect((await sessionRoute.GET(req("/api/qfinera/auth/session", undefined, { cookie: cookieHeader(old) }))).status).toBe(401);
    expect((await sessionRoute.GET(req("/api/qfinera/auth/session", undefined, { cookie: cookieHeader(rotated) }))).status).toBe(200);
  });

  it("account: only your own; you can sign out your other sessions but not someone else's", async () => {
    const other = await createUser(db, "otheruser");
    const otherSession = await db.query("SELECT id FROM qfinance_sessions WHERE user_id = $1", [other.id]);
    const mine = cookieFrom(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: "third passphrase here" }))) as Cookie;
    const r = await sessionsRoute.POST(req("/api/qfinera/account/sessions", { sessionId: Number(otherSession.rows[0].id) }, { cookie: cookieHeader(mine) }));
    expect(r.status).toBe(404);
    expect((await sessionRoute.GET(request(other, "/api/qfinera/auth/session"))).status).toBe(200);
    const me = await json(await accountRoute.GET(req("/api/qfinera/account", undefined, { cookie: cookieHeader(mine) })));
    expect(JSON.stringify(me.body)).not.toMatch(/password_hash|scrypt\$|token_hash/);
    expect((await accountRoute.GET(req("/api/qfinera/account"))).status).toBe(401);
  });

  it("admin: needs the existing admin login; lists users without secrets; suspend signs out and blocks sign-in", async () => {
    expect((await adminUsersRoute.GET(req("/api/admin/qfinance/users"))).status).toBe(401);
    const admin = `${ADMIN_COOKIE}=${createAdminCookieValue("admin-test-password")}`;
    const list = await json(await adminUsersRoute.GET(req("/api/admin/qfinance/users?q=asha", undefined, { cookie: admin })));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toMatch(/scrypt\$|password_hash|token/);
    const asha = list.body.data.users[0];
    expect(asha).toMatchObject({ email: "asha@example.test", emailVerified: true, hasPassword: true });

    const live = cookieFrom(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: "third passphrase here" }))) as Cookie;
    const noReason = await adminUserRoute.POST(req(`/api/admin/qfinance/users/${asha.id}`, { action: "suspend" }, { cookie: admin }), params({ id: String(asha.id) }));
    expect(noReason.status).toBe(400);
    const s = await adminUserRoute.POST(req(`/api/admin/qfinance/users/${asha.id}`, { action: "suspend", reason: "Reported abuse" }, { cookie: admin }), params({ id: String(asha.id) }));
    expect(s.status).toBe(200);
    expect((await sessionRoute.GET(req("/api/qfinera/auth/session", undefined, { cookie: cookieHeader(live) }))).status).toBe(401);
    const blocked = await json(await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: "third passphrase here" })));
    expect(blocked.status).toBe(403);
    await adminUserRoute.POST(req(`/api/admin/qfinance/users/${asha.id}`, { action: "restore", reason: "Resolved" }, { cookie: admin }), params({ id: String(asha.id) }));
    expect((await loginRoute.POST(req("/api/qfinera/auth/login", { email: "asha@example.test", password: "third passphrase here" }))).status).toBe(200);

    const before = links.length;
    const reset = await json(await adminUserRoute.POST(req(`/api/admin/qfinance/users/${asha.id}`, { action: "send-password-reset" }, { cookie: admin }), params({ id: String(asha.id) })));
    expect(reset.status).toBe(200);
    expect(links.length).toBe(before + 1); // emailed to the user...
    expect(JSON.stringify(reset.body)).not.toContain(new URL(links[links.length - 1]).searchParams.get("token")); // ...never shown to the admin
    expect(reset.body.data.events.map((e: { action: string }) => e.action)).toEqual(
      expect.arrayContaining(["user.suspended", "user.restored", "user.password_reset_sent"])
    );
    await expect(db.query("DELETE FROM qfinance_admin_audit")).rejects.toThrow(/append-only/);
  });

  it("admin mutations reject cross-site requests", async () => {
    const admin = `${ADMIN_COOKIE}=${createAdminCookieValue("admin-test-password")}`;
    const r = await adminUserRoute.POST(
      new NextRequest("http://localhost:3000/api/admin/qfinance/users/1", {
        method: "POST",
        headers: { host: "localhost:3000", origin: "https://evil.example", cookie: admin, "content-type": "application/json" },
        body: JSON.stringify({ action: "suspend", reason: "csrf" }),
      }),
      params({ id: "1" })
    );
    expect(r.status).toBe(403);
  });
});
