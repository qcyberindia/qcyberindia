import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { safeNext } from "@/components/qfinance/qfinera-nav";
import { hashPassword, needsRehash, passwordProblem, verifyPassword } from "@/lib/qfinera-auth/password";
import { hashSecretToken, isWellFormedSecretToken, newSecretToken } from "@/lib/qfinera-auth/tokens";
import { clearedSessionCookie, sessionCookie, SESSION_TTL_DAYS } from "@/lib/qfinera-auth/sessions";
import * as loginRoute from "@/app/api/qfinera/auth/login/route";
import * as accountRoute from "@/app/api/qfinera/account/route";

describe("password hashing (scrypt)", () => {
  it("hashes with a random salt, verifies, and never contains the password", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).toMatch(/^scrypt\$17\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain("correct");
    expect(await verifyPassword("correct horse battery", a)).toBe(true);
    expect(await verifyPassword("correct horse batterY", a)).toBe(false);
    expect(needsRehash(a)).toBe(false);
  });

  it("rejects malformed or missing hashes safely", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "plaintext")).toBe(false);
    expect(await verifyPassword("x", "scrypt$30$8$1$AAAA$BBBB")).toBe(false);
    expect(needsRehash("scrypt$14$8$1$AAAAAAAAAAAAAAAAAAAAAA$" + "A".repeat(86))).toBe(true);
  });

  it("password policy favours length and blocks obvious choices", () => {
    expect(passwordProblem("a good long phrase")).toBeNull();
    expect(passwordProblem("short")).toMatch(/at least 10/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/repetitive/);
    expect(passwordProblem("password123")).toMatch(/common/);
    expect(passwordProblem("priya-secret-2026", { email: "priya@example.com" })).toMatch(/email/);
    expect(passwordProblem("x".repeat(129) + "abcd")).toMatch(/at most/);
  });
}, 20_000);

describe("secret tokens", () => {
  it("are 256-bit, unique, and stored only as SHA-256", () => {
    const t = newSecretToken();
    expect(isWellFormedSecretToken(t)).toBe(true);
    expect(newSecretToken()).not.toBe(t);
    expect(hashSecretToken(t)).toMatch(/^[0-9a-f]{64}$/);
    for (const bad of ["", "abc", "a".repeat(44), null, 42, "../etc/passwd"]) expect(isWellFormedSecretToken(bad)).toBe(false);
  });
});

describe("session cookie", () => {
  it("is httpOnly, SameSite=Lax, site-wide, carries only the opaque token, 30-day expiry", () => {
    const expires = new Date(Date.now() + SESSION_TTL_DAYS * 864e5);
    const c = sessionCookie("tok", expires);
    expect(c).toMatchObject({ name: "qf_sid", value: "tok", httpOnly: true, sameSite: "lax", path: "/", expires });
    expect(SESSION_TTL_DAYS).toBe(30);
    expect(clearedSessionCookie()).toMatchObject({ name: "qf_sid", value: "", maxAge: 0 });
  });
});

describe("post-sign-in redirect", () => {
  it("only allows internal QFinera paths", () => {
    expect(safeNext("/qfinera/pools/3/dashboard")).toBe("/qfinera/pools/3/dashboard");
    expect(safeNext("/qfinera/pools/join?token=abc")).toBe("/qfinera/pools/join?token=abc");
    for (const evil of ["https://evil.example", "//evil.example", "/\\evil.example", "/admin", "javascript:alert(1)", "/qfinera\\..\\x", null, undefined]) {
      expect(safeNext(evil as string)).toBe("/qfinera/pools");
    }
  });
});

describe("auth endpoints without a database", () => {
  it("refuse non-JSON and cross-site sign-in attempts before doing anything", async () => {
    const form = await loginRoute.POST(
      new NextRequest("http://localhost:3000/api/qfinera/auth/login", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", host: "localhost:3000" }, body: "email=a" })
    );
    expect(form.status).toBe(415);
    const cross = await loginRoute.POST(
      new NextRequest("http://localhost:3000/api/qfinera/auth/login", { method: "POST", headers: { "content-type": "application/json", host: "localhost:3000", origin: "https://evil.example" }, body: "{}" })
    );
    expect(cross.status).toBe(403);
  });

  it("the account endpoint requires a session", async () => {
    expect((await accountRoute.GET(new NextRequest("http://localhost:3000/api/qfinera/account"))).status).toBe(401);
  });
});
