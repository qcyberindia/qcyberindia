export type FundRole = "ADMIN" | "MANAGER" | "MEMBER";

export type ApiErrorFields = Record<string, string>;

export class ApiError extends Error {
  readonly code: string;
  readonly fields?: ApiErrorFields;
  readonly notImplemented?: boolean;

  constructor(
    code: string,
    message: string,
    fields?: ApiErrorFields,
    notImplemented = false,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.fields = fields;
    this.notImplemented = notImplemented;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        fields?: ApiErrorFields;
      };
    };

export type FundFetchOptions = {
  fundId?: string | number;
  params?: Record<string, string | number | boolean | null | undefined>;
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
};

function buildUrl(path: string, options: FundFetchOptions): string {
  const url = new URL(path, window.location.origin);

  if (options.fundId !== undefined) {
    url.searchParams.set("fund", String(options.fundId));
  }

  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return `${url.pathname}${url.search}`;
}

function makeApiError(
  payload: unknown,
  status?: number,
): ApiError {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload
  ) {
    const raw = (payload as {
      error?: {
        code?: unknown;
        message?: unknown;
        fields?: unknown;
      };
    }).error;

    const code =
      typeof raw?.code === "string"
        ? raw.code
        : status
          ? `HTTP_${status}`
          : "UNKNOWN";

    const message =
      typeof raw?.message === "string"
        ? raw.message
        : "The request could not be completed.";

    const fields =
      raw?.fields &&
      typeof raw.fields === "object"
        ? (raw.fields as ApiErrorFields)
        : undefined;

    return new ApiError(
      code,
      message,
      fields,
      code === "NOT_IMPLEMENTED" || status === 501,
    );
  }

  return new ApiError(
    status ? `HTTP_${status}` : "BAD_RESPONSE",
    "The request could not be completed.",
    undefined,
    status === 501,
  );
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "BAD_RESPONSE",
      "The server sent an unexpected response.",
    );
  }

  if (!response.ok) {
    throw makeApiError(payload, response.status);
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "ok" in payload &&
    (payload as { ok?: unknown }).ok === false
  ) {
    throw makeApiError(payload);
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "ok" in payload &&
    (payload as { ok?: unknown }).ok === true &&
    "data" in payload
  ) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

export async function fundFetch<T>(
  path: string,
  options: FundFetchOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";

  let response: Response;

  try {
    response = await fetch(buildUrl(path, options), {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: options.signal,
      headers:
        method === "GET"
          ? undefined
          : {
              "Content-Type": "application/json",
            },
      body:
        method === "GET" || options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(
      "NETWORK",
      "Could not reach the server. Check your connection and try again.",
    );
  }

  return parseResponse<T>(response);
}

export async function postJson<T>(
  url: string,
  body: unknown,
): Promise<ApiResult<T>> {
  try {
    return {
      ok: true,
      data: await fundFetch<T>(url, {
        method: "POST",
        body,
      }),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          fields: error.fields,
        },
      };
    }

    return {
      ok: false,
      error: {
        code: "INTERNAL",
        message: "The request could not be completed.",
      },
    };
  }
}

export function itemOf<T>(json: unknown): T {
  if (
    typeof json === "object" &&
    json !== null &&
    "ok" in json &&
    (json as { ok?: unknown }).ok === true &&
    "data" in json
  ) {
    return (json as { data: T }).data;
  }

  return json as T;
}

export type FundList<T> = {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
};

export function listOf<T>(json: unknown): FundList<T> {
  const data = itemOf<unknown>(json);

  if (Array.isArray(data)) {
    return {
      items: data as T[],
      total: data.length,
    };
  }

  if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;

    for (const key of [
      "items",
      "rows",
      "members",
      "contributions",
      "withdrawals",
      "trades",
      "holdings",
      "instruments",
      "watchlist",
      "comments",
      "audit",
    ]) {
      if (Array.isArray(record[key])) {
        const rows = record[key] as T[];

        return {
          items: rows,
          total:
            typeof record.total === "number"
              ? record.total
              : rows.length,
          page:
            typeof record.page === "number"
              ? record.page
              : undefined,
          pageSize:
            typeof record.pageSize === "number"
              ? record.pageSize
              : undefined,
        };
      }
    }
  }

  return {
    items: [],
    total: 0,
  };
}

export type DashboardDto = {
  fundValue: string;
  navPerUnit: string;
  cash: string;
  investedValue: string;
  totalUnits: string;
  memberCount: number;
  dailyPnl: string | null;
  latestNav: {
    as_of_date: string;
    nav: string;
    is_official: boolean;
    fund_value: string;
    cash: string;
    holdings_value: string;
  } | null;
  allocation: Array<{
    label: string;
    value: string;
    percent: string;
  }>;
  holdings: HoldingDto[];
  recentTrades: TradeDto[];
  recentContributions: ContributionDto[];
  recentWithdrawals: WithdrawalDto[];
  recentActivity: AuditDto[];
  pendingApprovals: {
    contributions: number;
    withdrawals: number;
    trades: number;
  };
};

export type MemberDto = {
  user_id: number;
  display_name: string;
  email?: string | null;
  role: FundRole;
  status: string;
  joined_at: string;
  contributed_capital: string;
  units: string;
  current_value: string | null;
  ownership_percent: string | null;
  last_activity_at: string | null;
};

export type ContributionDto = {
  id: number;
  member_id: number;
  member_name?: string;
  amount: string;
  status: string;
  created_at: string;
  payment_date: string;
  effective_date: string | null;
  nav_used: string | null;
  units_allocated: string | null;
  residual: string | null;
  approved_at: string | null;
  funds_confirmed_at: string | null;
  finalized_at: string | null;
  utr: string | null;
  payment_proof_reference: string | null;
};

export type WithdrawalDto = {
  id: number;
  member_id: number;
  member_name?: string;
  request_type: string;
  requested_amount: string | null;
  requested_units: string | null;
  status: string;
  nav_used: string | null;
  units_redeemed: string | null;
  gross_amount: string | null;
  charges: string | null;
  net_amount: string | null;
  residual: string | null;
  created_at: string;
  approved_at: string | null;
  effective_date: string | null;
  finalized_at: string | null;
};

export type TradeDto = {
  id: number;
  instrument_id: number;
  symbol: string;
  exchange: string;
  side: "BUY" | "SELL";
  trade_date: string;
  settlement_date: string | null;
  quantity: string;
  price: string;
  net_value: string;
  status: string;
  external_ref: string | null;
  created_at: string;
  brokerage: string | null;
  stt: string | null;
  gst: string | null;
  stamp_duty: string | null;
  other_charges: string | null;
  notes: string | null;
  reversal_reason: string | null;
};

export type HoldingDto = {
  instrument_id: number;
  symbol: string;
  name: string;
  exchange: string;
  quantity: string;
  average_cost: string;
  price: string | null;
  price_quality: string;
  price_as_of: string | null;
  market_value: string | null;
  unrealized_pnl: string | null;
  portfolio_percent: string | null;
};

export type InstrumentDto = {
  id: number;
  symbol: string;
  name: string;
  exchange: string;
};

export type WatchlistItemDto = {
  id: number;
  instrument_id: number;
  title: string;
  symbol: string;
  status: string;
  notes: string | null;
  thesis: string | null;
  research_url: string | null;
  price: string | null;
  price_quality: string;
  daily_change: string | null;
  daily_change_percent: string | null;
  comment_count: number;
  created_at: string;
};

export type WatchlistCommentDto = {
  id: number;
  author_name: string;
  created_at: string;
  body: string;
};

export type ReportKey = string;

export type ReportColumn = {
  key: string;
  label: string;
  kind?: string;
};

export type ReportDto = {
  title: string;
  note?: string | null;
  disclaimer?: string | null;
  permission?: string | null;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown> & {
    __row?: string | number;
  }>;
};

export type AuditDto = {
  id: number;
  user_id: number | null;
  actor_name?: string | null;
  entity_type: string;
  entity_id: string | number | null;
  action: string;
  created_at: string;
  diff?: Record<string, unknown> | null;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
};

export const endpoints = {
  root: "/api/qfinera/fund",
  dashboard: "/api/qfinera/fund/dashboard",
  members: "/api/qfinera/fund/members",
  contributions: "/api/qfinera/fund/contributions",
  withdrawals: "/api/qfinera/fund/withdrawals",
  trades: "/api/qfinera/fund/trades",
  holdings: "/api/qfinera/fund/holdings",
  instruments: "/api/qfinera/fund/instruments",
  watchlist: "/api/qfinera/fund/watchlist",
  reports: "/api/qfinera/fund/reports",
  audit: "/api/qfinera/fund/audit",
  settings: "/api/qfinera/fund/settings",

  action(basePath: string, id: string | number, _action: string) {
    return `${basePath}/${encodeURIComponent(String(id))}`;
  },
};
