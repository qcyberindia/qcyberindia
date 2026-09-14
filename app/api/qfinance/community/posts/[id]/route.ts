import { NextRequest, NextResponse } from "next/server";
import {
  getQFinanceCommunityPost,
  getQFinancePostAuthorId,
  updateOwnQFinanceCommunityPost,
  softDeleteOwnQFinanceCommunityPost,
} from "@/lib/db";
import { getQFinanceSessionFromRequest } from "@/lib/qfinance-community-auth";

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

// Edit own post. Ownership is never taken from the client — the session's
// userId (derived server-side from the signed cookie) is compared against
// the post's actual author_id, re-fetched fresh from the database, before
// any UPDATE runs. See lib/db.ts's updateOwnQFinanceCommunityPost for the
// second layer of the same check (the UPDATE's WHERE clause itself).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return NextResponse.json({ ok: false, error: "Invalid post id" }, { status: 400 });
  }

  const session = getQFinanceSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in to edit this post." }, { status: 401 });
  }

  const authorId = await getQFinancePostAuthorId(postId);
  if (authorId === null) {
    return NextResponse.json({ ok: false, error: "Post not found" }, { status: 404 });
  }
  if (authorId !== session.userId) {
    return NextResponse.json({ ok: false, error: "You can only edit your own posts." }, { status: 403 });
  }

  let body: { title?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const result = await updateOwnQFinanceCommunityPost(postId, session.userId, {
    title: body.title ?? "",
    body: body.body ?? "",
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// Delete own post — soft delete (status = 'removed'), never a hard DELETE,
// consistent with the moderation model the rest of Community already uses.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return NextResponse.json({ ok: false, error: "Invalid post id" }, { status: 400 });
  }

  const session = getQFinanceSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in to delete this post." }, { status: 401 });
  }

  const authorId = await getQFinancePostAuthorId(postId);
  if (authorId === null) {
    return NextResponse.json({ ok: false, error: "Post not found" }, { status: 404 });
  }
  if (authorId !== session.userId) {
    return NextResponse.json({ ok: false, error: "You can only delete your own posts." }, { status: 403 });
  }

  const result = await softDeleteOwnQFinanceCommunityPost(postId, session.userId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
