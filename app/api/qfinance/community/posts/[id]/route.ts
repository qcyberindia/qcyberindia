import { NextRequest, NextResponse } from "next/server";
import { getQFinanceCommunityPost } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return NextResponse.json({ ok: false, error: "Invalid post id" }, { status: 400 });
  }

  const result = await getQFinanceCommunityPost(postId);
  if (!result) {
    return NextResponse.json({ ok: false, error: "Post not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...result });
}
