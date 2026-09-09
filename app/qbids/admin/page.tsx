import { redirect } from "next/navigation";

// Migrated into the unified QCyberIndia admin at /admin/qbids (see
// components/admin/AdminShell.tsx and app/admin/*). Kept as a redirect so
// existing bookmarks/links to the old standalone Qbids admin page still
// land somewhere useful. The old auth cookie (qbids_admin, still the name
// used under the hood by lib/admin-auth.ts) carries over unchanged, so an
// already-logged-in admin won't need to log in again.
export default function LegacyQbidsAdminRedirect() {
  redirect("/admin/qbids");
}
