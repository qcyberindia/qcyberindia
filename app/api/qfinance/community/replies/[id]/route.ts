import { NextRequest, NextResponse } from "next/server";
import {
  getQFinanceReplyAuthorId,
  updateOwnQFinanceCommunityReply,
  softDeleteOwnQFinanceCommunityReply,
} from "@/lib/db";
import { getQFinanceSessionFromRequest } from "@/lib/qfinance-community-auth";

// Edit own reply. Same ownership-derivation pattern as posts/[id]/route.ts:
// identity comes from the verified session, never the client; the actual
// author_id is re-fetched from the database before any mutation runs.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const replyId = Number(id);
  if (!Number.isInteger(replyId)) {
    return NextResponse.json({ ok: false, error: "Invalid reply id" }, { status: 400 });
  }

  const session = getQFinanceSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in to edit this reply." }, { status: 401 });
  }

  const authorId = await getQFinanceReplyAuthorId(replyId);
  if (authorId === null) {
    return NextResponse.json({ ok: false, error: "Reply not found" }, { status: 404 });
  }
  if (authorId !== session.userId) {
    return NextResponse.json({ ok: false, error: "You can only edit your own replies." }, { status: 403 });
  }

  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const result = await updateOwnQFinanceCommunityReply(replyId, session.userId, body.body ?? "");
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// Delete own reply — soft delete, same reasoning as posts/[id]/route.ts's
// DELETE handler.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const replyId = Number(id);
  if (!Number.isInteger(replyId)) {
    return NextResponse.json({ ok: false, error: "Invalid reply id" }, { status: 400 });
  }

  const session = getQFinanceSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in to delete this reply." }, { status: 401 });
  }

  const authorId = await getQFinanceReplyAuthorId(replyId);
  if (authorId === null) {
    return NextResponse.json({ ok: false, error: "Reply not found" }, { status: 404 });
  }
  if (authorId !== session.userId) {
    return NextResponse.json({ ok: false, error: "You can only delete your own replies." }, { status: 403 });
  }

  const result = await softDeleteOwnQFinanceCommunityReply(replyId, session.userId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
