import { NextResponse, type NextRequest } from "next/server";
import { getRequestSession } from "@/lib/qfinera-auth/http";

/** Who is signed in (for client UI). Never returns anything sensitive. */
export async function GET(req: NextRequest) {
  const s = await getRequestSession(req);
  if (!s) return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    { ok: true, user: { id: s.userId, displayName: s.displayName } },
    { headers: { "Cache-Control": "no-store" } }
  );
}
