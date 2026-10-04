import { describe, expect, it } from "vitest";
import { canViewWatchItem, decideWatch, isModerator, watchCapabilities, type WatchActor } from "../../lib/watch/permissions";

const owner: WatchActor = { userId: 1, platformRole: "USER" };
const other: WatchActor = { userId: 2, platformRole: "USER" };
const manager: WatchActor = { userId: 3, platformRole: "MANAGER" };
const admin: WatchActor = { userId: 4, platformRole: "ADMIN" };
const published = { createdBy: 1, status: "PUBLISHED" as const };
const archived = { createdBy: 1, status: "ARCHIVED" as const };
const removed = { createdBy: 1, status: "REMOVED" as const };

describe("Global Watch visibility", () => {
  it("published items are visible to every signed-in account", () => {
    for (const a of [owner, other, manager, admin]) expect(canViewWatchItem(a, published)).toBe(true);
  });
  it("archived items: author and moderators only", () => {
    expect(canViewWatchItem(owner, archived)).toBe(true);
    expect(canViewWatchItem(other, archived)).toBe(false);
    expect(canViewWatchItem(manager, archived)).toBe(true);
    expect(canViewWatchItem(admin, archived)).toBe(true);
  });
  it("removed items: ADMIN only (not even the author)", () => {
    expect(canViewWatchItem(owner, removed)).toBe(false);
    expect(canViewWatchItem(manager, removed)).toBe(false);
    expect(canViewWatchItem(admin, removed)).toBe(true);
  });
});

describe("Global Watch edit / delete / archive", () => {
  it("the author edits, deletes and archives their own item directly", () => {
    for (const op of ["edit", "delete", "archive"] as const) expect(decideWatch(owner, published, op)).toBe("direct");
  });
  it("another user can do nothing to someone else's item", () => {
    for (const op of ["edit", "delete", "archive"] as const) expect(decideWatch(other, published, op)).toBe("deny");
  });
  it("a MANAGER archives directly but edit/delete of another's item needs ADMIN approval", () => {
    expect(decideWatch(manager, published, "archive")).toBe("direct");
    expect(decideWatch(manager, published, "edit")).toBe("propose");
    expect(decideWatch(manager, published, "delete")).toBe("propose");
    // ...but a manager's own item is theirs to change
    expect(decideWatch(manager, { createdBy: 3, status: "PUBLISHED" }, "delete")).toBe("direct");
  });
  it("ADMIN does everything directly", () => {
    for (const op of ["edit", "delete", "archive"] as const) expect(decideWatch(admin, published, op)).toBe("direct");
  });
  it("a removed item cannot be changed by anyone", () => {
    for (const a of [owner, manager, admin]) for (const op of ["edit", "delete", "archive"] as const) expect(decideWatch(a, removed, op)).toBe("deny");
  });
  it("capabilities summarise the decisions for the UI", () => {
    expect(watchCapabilities(owner, published)).toEqual({ edit: "direct", delete: "direct", archive: "direct", isOwner: true });
    expect(isModerator(manager) && isModerator(admin) && !isModerator(owner)).toBe(true);
  });
});
