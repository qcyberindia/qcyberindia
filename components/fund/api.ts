// Browser-side access to the pool API. Types are DERIVED from the server's
// own return types (type-only imports: nothing server-side is bundled), with
// Date turned into the ISO string JSON actually carries, so the UI and the
// API cannot silently drift apart.
import type { AuditRecord } from "@/lib/fund/audit";
import type { DashboardData, HoldingsSummary, MemberRow, ContributionListRow, ContributionDetail } from "@/lib/fund/queries";
import type { WithdrawalDetail, WithdrawalListRow } from "@/lib/fund/services/withdrawals";
import type { TradeDetail, TradePreview, TradeRecord } from "@/lib/fund/services/trades";
import type { ExpenseRecord } from "@/lib/fund/services/expenses";
import type { Instrument, RecordedPrice } from "@/lib/fund/services/market";
import type { WatchlistComment, WatchlistItem } from "@/lib/fund/services/watchlist";
import type { InviteRow, InvitePreview } from "@/lib/fund/services/invites";
import type { PoolSummary } from "@/lib/fund/services/pools";
import type { FundSettingsView } from "@/lib/fund/services/settings";
import type { NavPreview, NavSnapshotRow, StrikeResult } from "@/lib/fund/services/nav";
import type { DailyReport, StatementReport, positionsReport } from "@/lib/fund/services/reports";
import type { Quote } from "@/lib/market-data";

/** What a server type looks like after JSON.stringify / JSON.parse. */
export type Jsonify<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Jsonify<U>[]
    : T extends readonly (infer U)[]
      ? readonly Jsonify<U>[]
      : T extends object
        ? { [K in keyof T]: Jsonify<T[K]> }
        : T;

export type Dashboard = Jsonify<DashboardData>;
export type Holdings = Jsonify<HoldingsSummary>;
export type Member = Jsonify<MemberRow>;
export type Contribution = Jsonify<ContributionListRow>;
export type ContributionDetailDto = Jsonify<ContributionDetail>;
export type Withdrawal = Jsonify<WithdrawalListRow>;
export type WithdrawalDetailDto = Jsonify<WithdrawalDetail>;
export type Trade = Jsonify<TradeRecord>;
export type TradeDetailDto = Jsonify<TradeDetail>;
export type TradePreviewDto = Jsonify<TradePreview>;
export type Expense = Jsonify<ExpenseRecord>;
export type InstrumentDto = Instrument;
export type RecordedPriceDto = Jsonify<RecordedPrice>;
export type WatchItem = Jsonify<WatchlistItem>;
export type WatchComment = Jsonify<WatchlistComment>;
export type Invite = Jsonify<InviteRow>;
export type InvitePreviewDto = Jsonify<InvitePreview>;
export type Pool = Jsonify<PoolSummary>;
export type Settings = Jsonify<FundSettingsView>;
export type NavPreviewDto = Jsonify<NavPreview>;
export type NavSnapshot = Jsonify<NavSnapshotRow>;
export type StrikeResultDto = Jsonify<StrikeResult>;
export type Daily = Jsonify<DailyReport>;
export type Statement = Jsonify<StatementReport>;
export type PositionsReportDto = Jsonify<Awaited<ReturnType<typeof positionsReport>>>;
export type Audit = Jsonify<AuditRecord>;
export type QuoteDto = Quote;

export type Paged<K extends string, T> = { [P in K]: T[] } & { page: number; pageSize: number; total: number };

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly fields?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

function withQuery(path: string, query?: Query): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/** GET/POST/PATCH a QFinera API path. Throws ApiError with the server's safe message. */
export async function apiFetch<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH"; body?: unknown; query?: Query; signal?: AbortSignal } = {}
): Promise<T> {
  const method = opts.method ?? (opts.body === undefined ? "GET" : "POST");
  let res: Response;
  try {
    res = await fetch(withQuery(path, opts.query), {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: opts.signal,
      headers: method === "GET" ? undefined : { "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(opts.body ?? {}),
    });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") throw err;
    throw new ApiError("NETWORK", "Could not reach the server. Check your connection and try again.", 0);
  }
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    throw new ApiError("BAD_RESPONSE", "The server sent an unexpected response.", res.status);
  }
  const body = payload as { ok?: boolean; data?: T; error?: { code?: string; message?: string; fields?: Record<string, string> } };
  if (!res.ok || body.ok !== true) {
    throw new ApiError(
      body.error?.code ?? `HTTP_${res.status}`,
      body.error?.message ?? "The request could not be completed.",
      res.status,
      body.error?.fields
    );
  }
  return body.data as T;
}

/** "/api/qfinera/pools/12/trades" */
export function poolApi(poolId: number, path = ""): string {
  return `/api/qfinera/pools/${poolId}${path ? `/${path}` : ""}`;
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong. Please try again.";
}
