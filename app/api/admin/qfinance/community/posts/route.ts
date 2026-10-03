import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ADMIN_COOKIE, isValidAdminCookie } from "@/lib/admin-auth";
import { adminListQFinanceCommunityPosts, adminUpdateQFinancePostStatus } from "@/lib/db";

export async function GET(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const posts = await adminListQFinanceCommunityPosts();
  return NextResponse.json({ ok: true, posts });
}

export async function PATCH(req: NextRequest) {
  if (!isValidAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id, status } = await req.json().catch(() => ({}));
  if (!Number.isInteger(id) || typeof status !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const result = await adminUpdateQFinancePostStatus(id, status);
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  // The QFinera gateway caches its Community feed (ISR); refresh it now.
  revalidatePath("/qfinera");
  return NextResponse.json(result);
}
