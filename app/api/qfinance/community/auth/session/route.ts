import { NextResponse, type NextRequest } from "next/server";
import { getRequestSession, sessionTokenFrom } from "@/lib/qfinera-auth/http";
import { clearedSessionCookie } from "@/lib/qfinera-auth/sessions";
import { logout } from "@/lib/qfinera-auth/service";

// Kept for the Community UI. Backed by the QFinera server-side session.
export async function GET(req: NextRequest) {
  const s = await getRequestSession(req);
  if (!s) return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    { ok: true, user: { id: s.userId, email: s.email, displayName: s.displayName } },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function DELETE(req: NextRequest) {
  await logout(sessionTokenFrom(req)).catch((err) => console.error("QFinera: logout failed:", err));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearedSessionCookie());
  return res;
}
