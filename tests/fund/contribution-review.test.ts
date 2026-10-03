// The contribution review panel's role/state logic: which actions a viewer
// gets, which is the obvious next step, and the "Next:" sentence. Pure
// functions; the server re-checks every action.
import { describe, expect, it } from "vitest";
import type { ContributionDetailDto } from "@/components/fund/api";
import { contributionActions, nextStep } from "@/components/fund/views/ContributionReview";
import type { UiPermission } from "@/components/fund/permissions";
import { can as roleCan, type FundPermission, type FundRole } from "@/lib/fund/rbac";

type Role = FundRole;
// The UI receives exactly the server's role matrix (lib/fund/rbac).
const can = (role: Role) => (p: UiPermission) => roleCan(role, p as FundPermission);

function detail(status: string, memberId = 7, awaiting: ContributionDetailDto["awaiting"] = null): ContributionDetailDto {
  return {
    contribution: { id: 1, member_id: memberId, status, created_by: memberId } as ContributionDetailDto["contribution"],
    memberName: "Meera",
    awaiting,
    audit: null,
    proofs: [],
  };
}
const keys = (d: ContributionDetailDto, role: Role, userId = 1) => contributionActions(d, can(role), userId).map((a) => a.key);

describe("contribution review actions", () => {
  it("admin: approve is the next step on a pending contribution, then reject and cancel", () => {
    expect(keys(detail("PENDING"), "ADMIN")).toEqual(["approve", "reject", "cancel"]);
  });

  it("admin: confirm funds is the next step once approved", () => {
    expect(keys(detail("APPROVED"), "ADMIN")).toEqual(["confirm-funds", "reject", "cancel"]);
  });

  it("admin: allocate units once the NAV is official", () => {
    expect(keys(detail("AWAITING_NAV", 7, { navDate: "2026-10-05", navOfficial: true }), "ADMIN")).toEqual(["finalize", "cancel"]);
    expect(keys(detail("AWAITING_NAV", 7, { navDate: "2026-10-05", navOfficial: false }), "ADMIN")).toEqual(["cancel"]);
  });

  it("manager and member cannot approve, confirm or reject", () => {
    expect(keys(detail("PENDING"), "MANAGER")).toEqual([]);
    expect(keys(detail("APPROVED"), "MANAGER")).toEqual([]);
    expect(keys(detail("PENDING"), "MEMBER")).toEqual([]);
  });

  it("a contributor may cancel only their own pending contribution", () => {
    expect(keys(detail("PENDING", 7), "MEMBER", 7)).toEqual(["cancel"]);
    expect(keys(detail("APPROVED", 7), "MEMBER", 7)).toEqual([]);
  });

  it("closed contributions have no actions", () => {
    for (const s of ["FINALIZED", "REJECTED", "CANCELLED"]) expect(keys(detail(s), "ADMIN")).toEqual([]);
  });

  it("approve and confirm take an optional review note; reject requires a reason", () => {
    const [approve, reject] = contributionActions(detail("PENDING"), can("ADMIN"), 1);
    expect(approve.reason).toMatchObject({ label: "Review note", optional: true });
    expect(reject.reason).toMatchObject({ label: "Reason", min: 3 });
    expect(reject.reason?.optional).toBeFalsy();
  });

  it("an admin acting on their own contribution is told it is recorded as self-confirmed", () => {
    const [approve] = contributionActions(detail("PENDING", 1), can("ADMIN"), 1);
    expect(approve.consequences).toMatch(/self-confirmed/);
    const [other] = contributionActions(detail("PENDING", 7), can("ADMIN"), 1);
    expect(other.consequences).not.toMatch(/self-confirmed/);
  });
});

describe("next step text", () => {
  it("says who acts next, per role", () => {
    expect(nextStep(detail("PENDING"), can("ADMIN"), 1)).toMatch(/approve or reject/);
    expect(nextStep(detail("PENDING", 7), can("MEMBER"), 7)).toMatch(/review your payment/);
    expect(nextStep(detail("APPROVED"), can("ADMIN"), 1)).toMatch(/bank statement/);
    expect(nextStep(detail("APPROVED"), can("MEMBER"), 7)).toMatch(/Waiting for the administrator/);
    expect(nextStep(detail("AWAITING_NAV", 7, { navDate: "2026-10-05", navOfficial: false }), can("MEMBER"), 7)).toMatch(/2026-10-05/);
    expect(nextStep(detail("FINALIZED"), can("MEMBER"), 7)).toMatch(/Finalized/);
  });
});
