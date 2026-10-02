import type { NextRequest } from "next/server";
import { requireFundPermission } from "@/lib/fund/auth";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { fundIdFrom, jsonOk } from "@/lib/fund/http";
import { listMembers } from "@/lib/fund/queries";

/** Privileged roles get every member; a MEMBER gets only their own row. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await requireFundPermission(req, "members:view_self", fundIdFrom(req));
    return jsonOk({ members: await listMembers(readDb(), ctx) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
