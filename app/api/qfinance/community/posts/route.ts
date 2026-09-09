import { NextRequest, NextResponse } from "next/server";
import { listQFinanceCommunityPosts, createQFinanceCommunityPost } from "@/lib/db";
import { getQFinanceSessionFromRequest } from "@/lib/qfinance-community-auth";

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get("category") || undefined;
  const page = Number(req.nextUrl.searchParams.get("page") || "1");
  const result = await listQFinanceCommunityPosts({ category, page });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  const session = getQFinanceSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in to post a question." }, { status: 401 });
  }

  let body: { title?: string; body?: string; category?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  const result = await createQFinanceCommunityPost({
    authorId: session.userId,
    title: body.title ?? "",
    body: body.body ?? "",
    category: body.category ?? "",
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
