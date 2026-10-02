import type { NextRequest } from "next/server";
import { requireFundPermission } from "@/lib/fund/auth";
import { readDb } from "@/lib/fund/db";
import { toErrorResponse } from "@/lib/fund/errors";
import { fundIdFrom, jsonOk } from "@/lib/fund/http";
import { getDashboard } from "@/lib/fund/queries";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireFundPermission(req, "fund:view", fundIdFrom(req));
    return jsonOk(await getDashboard(readDb(), ctx));
  } catch (err) {
    return toErrorResponse(err);
  }
}
