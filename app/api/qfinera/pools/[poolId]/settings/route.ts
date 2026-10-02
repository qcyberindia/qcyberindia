import type { NextRequest } from "next/server";
import { readDb } from "@/lib/fund/db";
import { validationError } from "@/lib/fund/errors";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { assertPermission } from "@/lib/fund/rbac";
import { getSettings, updateSettings, type SettingsPatch } from "@/lib/fund/services/settings";
import { parseOptionalText, parseText, readJsonObject } from "@/lib/fund/validation";

export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ ctx }) => {
    assertPermission(ctx.actor, "settings:view");
    return jsonOk({ settings: await getSettings(readDb(), ctx.fund.id) });
  });
}

export async function PATCH(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, sctx }) => {
      const body = await readJsonObject(req);
      const patch: SettingsPatch = {};
      if (body.name !== undefined) patch.name = parseText(body.name, "name", { min: 3, max: 120 });
      if (body.description !== undefined) patch.description = parseOptionalText(body.description, "description", 1000);
      if (body.cutoffTimeIst !== undefined) patch.cutoffTimeIst = parseText(body.cutoffTimeIst, "cutoffTimeIst", { max: 5 });
      if (body.holidays !== undefined) {
        if (!Array.isArray(body.holidays) || !body.holidays.every((h) => typeof h === "string")) {
          throw validationError("Holidays must be a list of dates.", { holidays: "Invalid" });
        }
        patch.holidays = body.holidays as string[];
      }
      if (body.stcgRate !== undefined) patch.stcgRate = parseText(body.stcgRate, "stcgRate", { max: 6 });
      if (body.ltcgRate !== undefined) patch.ltcgRate = parseText(body.ltcgRate, "ltcgRate", { max: 6 });
      if (body.marketDataProvider !== undefined) {
        patch.marketDataProvider = parseText(body.marketDataProvider, "marketDataProvider", { max: 40 });
      }
      return jsonOk({ settings: await updateSettings(sctx, patch) });
    },
    { mutation: true }
  );
}
