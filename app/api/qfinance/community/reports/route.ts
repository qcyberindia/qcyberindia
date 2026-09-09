import { NextRequest, NextResponse } from "next/server";
import { createQFinanceCommunityReport, type ReportReason } from "@/lib/db";
import { getQFinanceSessionFromRequest } from "@/lib/qfinance-community-auth";

const VALID_REASONS: ReportReason[] = ["spam", "scam", "harassment", "misleading_claim", "personal_info", "other"];

export async function POST(req: NextRequest) {
  const session = getQFinanceSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Sign in to report content." }, { status: 401 });
  }

  let body: { targetType?: string; targetId?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (body.targetType !== "post" && body.targetType !== "reply") {
    return NextResponse.json({ ok: false, error: "Invalid target type" }, { status: 400 });
  }
  if (!Number.isInteger(body.targetId)) {
    return NextResponse.json({ ok: false, error: "Invalid target id" }, { status: 400 });
  }
  if (!VALID_REASONS.includes(body.reason as ReportReason)) {
    return NextResponse.json({ ok: false, error: "Invalid reason" }, { status: 400 });
  }

  const result = await createQFinanceCommunityReport({
    reporterId: session.userId,
    targetType: body.targetType,
    targetId: body.targetId as number,
    reason: body.reason as ReportReason,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
