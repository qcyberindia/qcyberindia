// Global Watch permissions. Pure; no I/O.
//
// Global Watch is product-wide (not tied to a pool), so it uses the
// account's platform role (qfinance_users.platform_role, migration 015),
// assigned only by the QCyberIndia site administrator:
//
//   USER     any active, signed-in QFinera account: read published items,
//            publish, and edit / archive / delete their OWN items.
//   MANAGER  moderates: archives or restores anyone's item directly
//            (reversible, nothing is lost); editing or deleting someone
//            else's item becomes a request for ADMIN approval.
//   ADMIN    edits, archives, restores and deletes anything; reviews
//            MANAGER requests.
//
// Delete is always a soft removal (status REMOVED, kept for audit).

export type PlatformRole = "USER" | "MANAGER" | "ADMIN";
export const PLATFORM_ROLES: readonly PlatformRole[] = ["USER", "MANAGER", "ADMIN"];

export type WatchActor = { userId: number; platformRole: PlatformRole };
export type WatchStatus = "PUBLISHED" | "ARCHIVED" | "REMOVED";
export type WatchItemRef = { createdBy: number; status: WatchStatus };

export type WatchOperation = "edit" | "delete" | "archive";
/** direct: do it now. propose: create a request for ADMIN approval. deny: not allowed. */
export type WatchDecision = "direct" | "propose" | "deny";

export function isModerator(actor: WatchActor): boolean {
  return actor.platformRole === "MANAGER" || actor.platformRole === "ADMIN";
}

/** Who may see an item at all. Removed items exist only for ADMIN. */
export function canViewWatchItem(actor: WatchActor, item: WatchItemRef): boolean {
  if (item.status === "PUBLISHED") return true;
  if (item.status === "ARCHIVED") return item.createdBy === actor.userId || isModerator(actor);
  return actor.platformRole === "ADMIN";
}

export function decideWatch(actor: WatchActor, item: WatchItemRef, op: WatchOperation): WatchDecision {
  if (item.status === "REMOVED") return "deny";
  if (actor.platformRole === "ADMIN") return "direct";
  if (item.createdBy === actor.userId) return "direct";
  if (actor.platformRole === "MANAGER") return op === "archive" ? "direct" : "propose";
  return "deny";
}

export function watchCapabilities(actor: WatchActor, item: WatchItemRef) {
  return {
    edit: decideWatch(actor, item, "edit"),
    delete: decideWatch(actor, item, "delete"),
    archive: decideWatch(actor, item, "archive"),
    isOwner: item.createdBy === actor.userId,
  };
}
