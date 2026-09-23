import { NextRequest, NextResponse } from "next/server";
import { createQFinanceCommunityReply } from "@/lib/db";
import { getQFinanceSessionFromRequest } from "@/lib/qfinance-community-auth";
import { sendQFinanceReplyNotifications } from "@/lib/qfinance-community-notifications";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = getQFinanceSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in to reply." }, { status: 401 });
  }

  const { id } = await params;
  const postId = Number(id);
  if (!Number.isInteger(postId)) {
    return NextResponse.json({ ok: false, error: "Invalid post id" }, { status: 400 });
  }

  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const result = await createQFinanceCommunityReply({
    authorId: session.userId,
    postId,
    body: body.body ?? "",
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  // Notifications are sent only after the reply is confirmed persisted
  // above, and a failure here must never fail or roll back the reply
  // itself — sendQFinanceReplyNotifications already never throws
  // internally, but this try/catch is defense in depth per the same
  // principle used everywhere else email is sent alongside a DB write in
  // this codebase (see app/api/qfinance/route.ts).
  try {
    await sendQFinanceReplyNotifications(
      postId,
      result.id,
      session.userId,
      session.displayName,
      body.body ?? ""
    );
  } catch (err) {
    console.error("QFinance reply notifications: unexpected error", { postId, replyId: result.id, err });
  }

  return NextResponse.json({ ok: true, id: result.id });
}
