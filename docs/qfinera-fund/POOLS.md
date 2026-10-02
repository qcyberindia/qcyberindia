# QFinera Pools: Architecture and Operations

Private, invite-only pooled-accounting workspaces. Legal boundary: [LEGAL_GATE.md](./LEGAL_GATE.md). Accounting rules: [ACCOUNTING_RULES.md](./ACCOUNTING_RULES.md).

## Tenancy

A **pool** is a row of `qfinera_funds`. Every financial table is keyed by `fund_id`, so each pool's members, capital, units, NAV, cash, trades, holdings, expenses, reports and audit history are isolated.

Every request is authorized against the caller's membership of **that** pool (`lib/fund/auth.ts`, `lib/fund/pool-http.ts`):

- pool id comes from the URL path; there is no default pool;
- not a member, removed, or malformed id → `404` (pool existence never leaks);
- suspended → `403`; role permissions (`lib/fund/rbac.ts`) are checked again inside every service;
- records are always looked up by `(id, fund_id)`, so a record id from another pool is "not found".

Manually recorded prices are scoped to the pool that recorded them (`price_snapshots.fund_id`), so one pool can never move another pool's NAV.

## Lifecycle

Create pool (creator = ADMIN) → invite (single-use, email-bound, hashed token, 7 days) → join → contribution (pending → approved → funds confirmed → units at next EOD NAV) → trades (draft → executed on trade date → settled; ADMIN reversal) → ADMIN records closing prices and strikes the official NAV (requests waiting for that date finalize automatically) → withdrawals (requested → approved → redeemed at next EOD NAV) → reports and audit.

## Migrations

| File | Status |
|---|---|
| 006, 007 | Existing, unchanged |
| 008 `qfinera_fund_workflow` | Reviewed; required (trade lifecycle, NAV cutoff settings, watchlist fields) |
| 009 `qfinera_pools` | New; required (participation gate, `removed` memberships, pool-scoped append-only prices, one open withdrawal per member) |

All are additive, idempotent and transactional. Apply **manually**, in order, after a backup:

```
psql "$DATABASE_URL" -f db/migrations/008_qfinera_fund_workflow.sql
psql "$DATABASE_URL" -f db/migrations/009_qfinera_pools.sql
```

Nothing applies migrations automatically.

## Tests

`npm test` runs all unit tests. The database integration suites (`tests/fund/integration`) run only when `FUND_TEST_DATABASE_URL` points at a **local** PostgreSQL admin connection; they create and drop their own throwaway database and refuse any non-local host:

```
FUND_TEST_DATABASE_URL=postgres://user@127.0.0.1:5432/postgres npm test
```

## Known limits

- Only the `manual` market-data provider exists (prices recorded by an ADMIN). A vendor feed is a new adapter in `lib/market-data`.
- Correcting a NAV that units were already allocated or redeemed at is refused; that needs an explicit ADJUSTMENT accounting decision.
- After the email sign-in link, users land on the Community page and navigate back to `/qfinera/pools` (the shared magic-link flow was left unchanged).
- No pool closing workflow yet (`qfinera_funds.status = 'closed'` is honoured but not settable from the UI).
