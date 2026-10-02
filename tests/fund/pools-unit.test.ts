// Pool-layer checks that need no database: request gating, invite tokens,
// validation, the product gate, and static checks on the migrations.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { InvariantError } from "@/lib/accounting/invariants";
import { FundError } from "@/lib/fund/errors";
import { MAX_POOL_MEMBERS, PARTICIPATION_MODE } from "@/lib/fund/product-gate";
import { permissionsOf } from "@/lib/fund/rbac";
import { hashInviteToken, isWellFormedInviteToken, newInviteToken } from "@/lib/fund/services/invites";
import { normalizeSymbol } from "@/lib/fund/services/market";
import { validateSettingsPatch } from "@/lib/fund/services/settings";
import { accountingRule } from "@/lib/fund/services/types";
import { parseBackdate, parseDecimal, parseOptionalTime } from "@/lib/fund/validation";
import * as contributionsRoute from "@/app/api/qfinera/pools/[poolId]/contributions/route";
import * as poolsRoute from "@/app/api/qfinera/pools/route";

const migration = (name: string) => readFileSync(join(process.cwd(), "db/migrations", name), "utf8");

describe("pool API gating without a session", () => {
  it("rejects an anonymous read with 401 before touching any pool", async () => {
    const res = await contributionsRoute.GET(
      new NextRequest("http://localhost:3000/api/qfinera/pools/1/contributions"),
      { params: Promise.resolve({ poolId: "1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("answers a malformed pool id with 404 (indistinguishable from someone else's pool)", async () => {
    for (const poolId of ["abc", "-1", "1.5", "1 OR 1=1", "9999999999"]) {
      const res = await contributionsRoute.GET(
        new NextRequest(`http://localhost:3000/api/qfinera/pools/x/contributions`),
        { params: Promise.resolve({ poolId }) }
      );
      expect(res.status, poolId).toBe(404);
    }
  });

  it("rejects non-JSON and cross-origin mutations before authenticating", async () => {
    const form = await poolsRoute.POST(
      new NextRequest("http://localhost:3000/api/qfinera/pools", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", host: "localhost:3000" },
        body: "name=x",
      })
    );
    expect(form.status).toBe(415);
    const cross = await poolsRoute.POST(
      new NextRequest("http://localhost:3000/api/qfinera/pools", {
        method: "POST",
        headers: { "content-type": "application/json", host: "localhost:3000", origin: "https://evil.example" },
        body: "{}",
      })
    );
    expect(cross.status).toBe(403);
  });
});

describe("invite tokens", () => {
  it("are 256-bit base64url, unique, and stored only as a SHA-256 hash", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a).not.toBe(b);
    expect(isWellFormedInviteToken(a)).toBe(true);
    expect(hashInviteToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(a)).toBe(hashInviteToken(a));
    expect(hashInviteToken(a)).not.toContain(a);
  });

  it("malformed tokens are rejected by shape", () => {
    for (const t of ["", "short", "a".repeat(44), `${"a".repeat(42)}!`, "../../etc/passwd"]) {
      expect(isWellFormedInviteToken(t), t).toBe(false);
    }
  });
});

describe("input validation", () => {
  it("money only as decimal strings with bounded scale", () => {
    expect(parseDecimal("1234.56", { label: "amount", scale: 2 }).toDecimalString(2)).toBe("1234.56");
    expect(() => parseDecimal(1234.56, { label: "amount", scale: 2 })).toThrow(FundError);
    expect(() => parseDecimal("1e5", { label: "amount", scale: 2 })).toThrow(FundError);
    expect(() => parseDecimal("1.001", { label: "amount", scale: 2 })).toThrow(FundError);
    expect(() => parseDecimal("-1", { label: "amount", scale: 2 })).toThrow(FundError);
    expect(() => parseDecimal("0", { label: "amount", scale: 2, positive: true })).toThrow(FundError);
    expect(() => parseDecimal("99999999999999999", { label: "amount", scale: 2 })).toThrow(FundError);
  });

  it("backdate requests need both a reason and an explicit confirmation flag downstream", () => {
    expect(parseBackdate({})).toBeNull();
    expect(parseBackdate({ backdateReason: "late note" })).toEqual({ reason: "late note", confirmed: false });
    expect(parseBackdate({ backdateReason: "late note", confirmBackdate: "true" })).toEqual({ reason: "late note", confirmed: false });
    expect(parseBackdate({ backdateReason: "late note", confirmBackdate: true })).toEqual({ reason: "late note", confirmed: true });
  });

  it("times and symbols", () => {
    expect(parseOptionalTime("15:30", "time")).toBe("15:30");
    expect(() => parseOptionalTime("24:00", "time")).toThrow(FundError);
    expect(normalizeSymbol(" m&m ")).toBe("M&M");
    expect(normalizeSymbol("BAJAJ-AUTO")).toBe("BAJAJ-AUTO");
    expect(() => normalizeSymbol("DROP TABLE")).toThrow(FundError);
    expect(() => normalizeSymbol("")).toThrow(FundError);
  });

  it("settings patches", () => {
    expect(() => validateSettingsPatch({ cutoffTimeIst: "16:00", holidays: ["2026-10-02"], stcgRate: "20", ltcgRate: "12.5" })).not.toThrow();
    expect(() => validateSettingsPatch({ cutoffTimeIst: "4pm" })).toThrow(FundError);
    expect(() => validateSettingsPatch({ holidays: ["2026-02-30"] })).toThrow(FundError);
    expect(() => validateSettingsPatch({ stcgRate: "100.01" })).toThrow(FundError);
    expect(() => validateSettingsPatch({ ltcgRate: "-1" })).toThrow(FundError);
    expect(() => validateSettingsPatch({ marketDataProvider: "some-feed" })).toThrow(FundError);
  });
});

describe("accounting rule errors", () => {
  it("surface pure accounting violations as a 409 the user can act on", () => {
    let caught: unknown;
    try {
      accountingRule(() => {
        throw new Error("charges must be less than the withdrawal amount");
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(FundError);
    expect((caught as FundError).status).toBe(409);
    expect((caught as FundError).message).toBe("Charges must be less than the withdrawal amount.");
  });

  it("also for async work, and never swallow database or invariant errors", async () => {
    await expect(accountingRule(async () => Promise.reject(new Error("amount is too small")))).rejects.toBeInstanceOf(FundError);
    const dbErr = Object.assign(new Error("duplicate key"), { code: "23505" });
    expect(() => accountingRule(() => { throw dbErr; })).toThrow(dbErr);
    const inv = new InvariantError([{ code: "NEGATIVE_CASH", message: "cash would be -1.00" }]);
    expect(() => accountingRule(() => { throw inv; })).toThrow(inv);
  });
});

describe("roles", () => {
  it("a suspended or removed member holds no permissions at all", () => {
    expect(permissionsOf({ userId: 1, role: "ADMIN", status: "suspended" })).toEqual([]);
    expect(permissionsOf({ userId: 1, role: "ADMIN", status: "removed" })).toEqual([]);
    expect(permissionsOf({ userId: 1, role: "MEMBER", status: "active" })).not.toContain("audit:view");
    expect(permissionsOf({ userId: 1, role: "ADMIN", status: "active" })).toContain("corrections:backdate");
  });
});

describe("migrations (static)", () => {
  const m009 = migration("009_qfinera_pools.sql");

  it("pools are private by a database CHECK, not by configuration", () => {
    expect(PARTICIPATION_MODE).toBe("PRIVATE_INVITE_ONLY");
    expect(m009).toMatch(/CHECK \(participation_mode = 'PRIVATE_INVITE_ONLY'\)/);
    expect(MAX_POOL_MEMBERS).toBeGreaterThan(1);
  });

  it("ledger, audit log, NAV history and price snapshots are append-only", () => {
    const m007 = migration("007_qfinera_fund_corrections.sql");
    expect(m007).toMatch(/BEFORE UPDATE OR DELETE ON qfinera_fund_ledger_entries/);
    expect(m007).toMatch(/BEFORE UPDATE OR DELETE ON qfinera_fund_audit_log/);
    expect(m007).toMatch(/BEFORE TRUNCATE ON qfinera_fund_audit_log/);
    expect(m007).toMatch(/BEFORE UPDATE OR DELETE ON qfinera_fund_nav_snapshots/);
    expect(m009).toMatch(/BEFORE UPDATE OR DELETE ON qfinera_fund_price_snapshots/);
  });

  it("009 is additive: it never drops tables or columns, or deletes rows", () => {
    expect(m009).not.toMatch(/DROP\s+TABLE|DROP\s+COLUMN|DELETE\s+FROM|TRUNCATE\s+qfinera/i);
    expect(m009.trim().startsWith("--")).toBe(true);
    expect(m009).toMatch(/^BEGIN;$/m);
    expect(m009).toMatch(/^COMMIT;$/m);
  });

  it("migration 006 is unchanged", () => {
    // Its content is the deployed contract; any edit must be a new migration.
    expect(migration("006_create_qfinera_fund.sql")).toMatch(/initial_nav NUMERIC\(20,4\) NOT NULL DEFAULT 10\.0000/);
  });
});
