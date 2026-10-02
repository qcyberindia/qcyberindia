// Fund settings (ADMIN). Every change is audited with its before/after state.
//
//   NAV cutoff (IST) and market holidays decide the next applicable EOD NAV
//   for NEW requests. A request already waiting keeps the NAV date it was
//   given when it was confirmed/approved (stored in effective_date), so a
//   settings change never moves it.
//   Tax assumptions are informational only and never affect NAV or units.
import { isValidIsoDate, parseCutoffMinutes } from "@/lib/accounting/nav-cutoff";
import { writeAudit } from "@/lib/fund/audit";
import { inTransaction, lockFund, one, type Db } from "@/lib/fund/db";
import { conflictError, notFoundError, validationError } from "@/lib/fund/errors";
import { assertPermission } from "@/lib/fund/rbac";
import { loadSettings } from "@/lib/fund/state";
import type { ServiceCtx } from "@/lib/fund/services/types";
import { SUPPORTED_MARKET_DATA_PROVIDERS } from "@/lib/market-data";

export type FundSettingsView = {
  fund: { name: string; description: string | null; status: string; currency: string; initialNav: string };
  nav: { cutoffTimeIst: string; holidays: string[] };
  taxAssumptions: { stcgRate: string; ltcgRate: string };
  marketDataProvider: string;
  supportedProviders: readonly string[];
  updatedAt: Date | null;
  updatedByName: string | null;
};

export async function getSettings(db: Db, fundId: number): Promise<FundSettingsView> {
  const fund = await one<{ name: string; description: string | null; status: string; currency: string; initial_nav: string }>(
    db,
    "SELECT name, description, status, currency, initial_nav::text AS initial_nav FROM qfinera_funds WHERE id = $1",
    [fundId]
  );
  if (!fund) throw notFoundError("Fund");
  const settings = await loadSettings(db, fundId);
  const meta = await one<{ updated_at: Date; name: string | null }>(
    db,
    `SELECT s.updated_at, u.display_name AS name FROM qfinera_fund_settings s
       LEFT JOIN qfinance_users u ON u.id = s.updated_by WHERE s.fund_id = $1`,
    [fundId]
  );
  return {
    fund: {
      name: fund.name,
      description: fund.description,
      status: fund.status,
      currency: fund.currency,
      initialNav: fund.initial_nav,
    },
    nav: { cutoffTimeIst: settings.nav.cutoffTimeIst, holidays: [...settings.nav.holidays].sort() },
    taxAssumptions: settings.taxAssumptions,
    marketDataProvider: settings.marketDataProvider,
    supportedProviders: SUPPORTED_MARKET_DATA_PROVIDERS,
    updatedAt: meta?.updated_at ?? null,
    updatedByName: meta?.name ?? null,
  };
}

export type SettingsPatch = {
  name?: string;
  description?: string | null;
  cutoffTimeIst?: string;
  holidays?: string[];
  stcgRate?: string;
  ltcgRate?: string;
  marketDataProvider?: string;
};

/** Pure validation of a settings patch (also used by the route). */
export function validateSettingsPatch(patch: SettingsPatch): void {
  if (patch.cutoffTimeIst !== undefined) {
    try {
      parseCutoffMinutes(patch.cutoffTimeIst);
    } catch {
      throw validationError("Cutoff must be a 24-hour time such as 16:00.", { cutoffTimeIst: "Use HH:MM" });
    }
  }
  if (patch.holidays !== undefined) {
    if (patch.holidays.length > 400) throw validationError("Too many holidays.", { holidays: "At most 400" });
    for (const h of patch.holidays) {
      if (!isValidIsoDate(h)) throw validationError(`"${h}" is not a valid date (YYYY-MM-DD).`, { holidays: "Invalid date" });
    }
  }
  for (const [key, value] of [["stcgRate", patch.stcgRate], ["ltcgRate", patch.ltcgRate]] as const) {
    if (value === undefined) continue;
    if (!/^\d{1,3}(\.\d{1,2})?$/.test(value) || Number(value) > 100) {
      throw validationError("Rates are percentages between 0 and 100 (up to 2 decimals).", { [key]: "0 to 100" });
    }
  }
  if (
    patch.marketDataProvider !== undefined &&
    !(SUPPORTED_MARKET_DATA_PROVIDERS as readonly string[]).includes(patch.marketDataProvider)
  ) {
    throw validationError("That market data provider is not supported.", { marketDataProvider: "Unsupported" });
  }
}

export async function updateSettings(ctx: ServiceCtx, patch: SettingsPatch): Promise<FundSettingsView> {
  assertPermission(ctx.actor, "settings:manage");
  validateSettingsPatch(patch);

  return inTransaction(async (db) => {
    await lockFund(db, ctx.fundId);
    const before = await getSettings(db, ctx.fundId);

    const holidays = patch.holidays ? [...new Set(patch.holidays)].sort() : before.nav.holidays;
    if (patch.holidays) {
      const { rows } = await db.query<{ d: string }>(
        `SELECT as_of_date::text AS d FROM qfinera_fund_nav_snapshots
          WHERE fund_id = $1 AND is_official AND as_of_date = ANY($2::date[])`,
        [ctx.fundId, holidays]
      );
      if (rows.length > 0) {
        throw conflictError(
          `An official NAV already exists for ${rows.map((r) => r.d).join(", ")}; that date cannot become a holiday.`
        );
      }
    }

    if (patch.name !== undefined || patch.description !== undefined) {
      await db.query(
        `UPDATE qfinera_funds SET name = COALESCE($2, name),
                description = CASE WHEN $3::boolean THEN $4 ELSE description END, updated_at = now()
          WHERE id = $1`,
        [ctx.fundId, patch.name ?? null, patch.description !== undefined, patch.description ?? null]
      );
    }

    const nav = { cutoff_time_ist: patch.cutoffTimeIst ?? before.nav.cutoffTimeIst, holidays };
    const tax = {
      stcg_rate: patch.stcgRate ?? before.taxAssumptions.stcgRate,
      ltcg_rate: patch.ltcgRate ?? before.taxAssumptions.ltcgRate,
    };
    await db.query(
      `INSERT INTO qfinera_fund_settings (fund_id, nav_settings, tax_assumptions, market_data_provider, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, now())
       ON CONFLICT (fund_id) DO UPDATE
         SET nav_settings = EXCLUDED.nav_settings, tax_assumptions = EXCLUDED.tax_assumptions,
             market_data_provider = EXCLUDED.market_data_provider, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [ctx.fundId, JSON.stringify(nav), JSON.stringify(tax), patch.marketDataProvider ?? before.marketDataProvider, ctx.actor.userId]
    );

    const after = await getSettings(db, ctx.fundId);
    const snapshot = (s: FundSettingsView) => ({
      name: s.fund.name,
      description: s.fund.description,
      cutoff_time_ist: s.nav.cutoffTimeIst,
      holidays: s.nav.holidays,
      stcg_rate: s.taxAssumptions.stcgRate,
      ltcg_rate: s.taxAssumptions.ltcgRate,
      market_data_provider: s.marketDataProvider,
    });
    await writeAudit(db, {
      fundId: ctx.fundId,
      userId: ctx.actor.userId,
      action: "settings.updated",
      entityType: "settings",
      entityId: ctx.fundId,
      before: snapshot(before),
      after: snapshot(after),
      meta: ctx.meta,
    });
    return after;
  });
}
