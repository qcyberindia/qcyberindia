// The one QFinera navigation model, shared by the desktop header, the
// mobile tab bar and the footer. Pure data.
export type QNavItem = { href: string; label: string; match: string[] };

export const PRIMARY_NAV: readonly QNavItem[] = [
  { href: "/qfinera/learn/beginner", label: "Learn", match: ["/qfinera/learn", "/qfinera/beginner"] },
  { href: "/qfinera/research", label: "Research", match: ["/qfinera/research", "/qfinera/why-india-investing"] },
  { href: "/qfinera/community", label: "Community", match: ["/qfinera/community"] },
  { href: "/qfinera/pools", label: "Pools", match: ["/qfinera/pools"] },
];

export function isActive(pathname: string | null, item: Pick<QNavItem, "match">): boolean {
  if (!pathname) return false;
  return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/** Only internal QFinera paths are accepted as a post-sign-in destination (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/qfinera/pools"): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/qfinera") || next.startsWith("//") || next.includes("\\") || /[\r\n]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://x.invalid");
    if (u.origin !== "http://x.invalid") return fallback;
    return `${u.pathname}${u.search}`;
  } catch {
    return fallback;
  }
}
