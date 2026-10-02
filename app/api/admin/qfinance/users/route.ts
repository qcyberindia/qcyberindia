import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { toErrorResponse } from "@/lib/fund/errors";
import { jsonOk } from "@/lib/fund/http";
import { parseEnum, parseOptionalText, parsePaging } from "@/lib/fund/validation";
import { adminListUsers } from "@/lib/qfinera-auth/admin";

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const sp = req.nextUrl.searchParams;
    const { page, pageSize, offset } = parsePaging(sp, { pageSize: 50, maxPageSize: 100 });
    const result = await adminListUsers({
      q: parseOptionalText(sp.get("q"), "q", 120),
      status: sp.get("status") ? parseEnum(sp.get("status"), "status", ["active", "suspended"] as const) : null,
      pageSize,
      offset,
    });
    return jsonOk({ ...result, page, pageSize });
  } catch (err) {
    return toErrorResponse(err);
  }
}
