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

## Roles and approvals

Roles, least to most privileged (`lib/fund/rbac.ts`):

| Role | Can |
|---|---|
| VIEWER | Read the pool and their own records. Ask to become a MEMBER (`join-requests`). Creates nothing. |
| MEMBER | Own contributions/withdrawals, comments, own watchlist notes. |
| MANAGER | Records trades, expenses and contributions for members; reviews join requests; reads settings and the audit log. **Proposes** every ADMIN-only change. |
| ADMIN | Everything, including approving proposals, roles, settings and deleting the pool. |

**Manager → Admin approval** (`lib/fund/services/change-requests.ts`, table `qfinera_change_requests`). When a MANAGER calls an ADMIN-only endpoint (approve/reject/cancel/finalize contributions and withdrawals, reverse/correct trades, approve/reject expenses, strike NAV, change settings, change a member's role/status, delete the pool), `actOrPropose()` stores the validated request body as a PENDING request and answers `202 { pendingApproval: true, request }`. Nothing changes. When an ADMIN approves (`POST /pools/:id/requests/:rid {action:"approve"}`), the **same service call** runs with the ADMIN's own context, so every permission, status, NAV and accounting rule is enforced again. A failed execution leaves the request PENDING with `last_error`. A claim (`PENDING → EXECUTING`) guarantees one execution. Requests, approvals and rejections are audited (`change_request.*`). A requester cannot approve their own request; backdating and exports cannot be proposed.

**Join requests** (`qfinera_fund_join_requests`): an ADMIN's approval makes the viewer a MEMBER at once; a MANAGER's approval creates a `member.update` change request linked to the join request.

## Deletion, restore and purge

- `POST /api/qfinera/pools/:id/deletion { confirmName, reason? }` — ADMIN, exact pool name. Sets `deleted_at`, `deleted_by`, `deletion_reason`, `purge_after = deleted_at + 30 days`; cancels open requests and invites. The pool disappears for everyone (`resolveFundContext`, `listMyPools`, `lockFund`, `assertFundActive` and invites ignore deleted pools). Nothing is erased.
- `POST /api/qfinera/pools/:id/restore` — an active ADMIN of the pool, before `purge_after`. Listed for ADMINs on the Pools page.
- **Purge** — `lib/fund/pool-purge.ts` deletes a pool's rows child-first, one transaction per pool, then writes a tombstone to `qfinance_admin_audit`. The append-only triggers allow a row DELETE only when the transaction sets `qfinera.purge_fund_id` to that pool **and** the pool is deleted and past `purge_after` (`qfinera_purge_allowed()`, migration 015); the `qfinera_funds` row has the same guard. An active pool cannot be purged even by direct SQL.

Run the purge daily (cron, systemd timer or a scheduled job). It is idempotent:

```
node scripts/purge-deleted-pools.ts            # dry run: lists what is due
node scripts/purge-deleted-pools.ts --apply    # purge pools past retention
```

The QCyberIndia admin can also `GET`/`POST /api/admin/qfinance/pools/purge` (admin cookie).

## Global Watch

Product-wide intelligence (`lib/watch`, tables `qfinera_watch_items`, `qfinera_watch_attachments`). Any signed-in active account reads published items and publishes; authors edit/archive/delete their own. `qfinance_users.platform_role` (set by the QCyberIndia admin on the user page) adds moderators: MANAGER archives directly and proposes edits/deletions of others' items (platform-scope change requests); ADMIN acts directly and reviews requests. Deletes are soft (`REMOVED`). Audit rows are in `qfinera_fund_audit_log` with `fund_id NULL`.

## NAV status and Pool Chat

- **NAV status** (`GET /nav/status`, dashboard and contributions page): the latest official NAV, the dates contributions/withdrawals are waiting for, and for ADMIN/MANAGER what blocks the next strike (cutoff not passed, missing closing price, open intraday position). "Finalize NAV" links to Reports → Daily report for that date (`/reports?date=YYYY-MM-DD`). Units are still allocated only by striking the official EOD NAV; nothing is automatic.
- A NAV date cannot be struck while requests wait for an **earlier** un-struck date: that date must be struck first, otherwise its requests would fall behind the latest official NAV and need a backdated correction.
- **Pool Chat** (`/qfinera/pools/[poolId]/chat`, table `qfinera_fund_messages`, migration 016): every active member, VIEWER included, reads and posts (`chat:view`, `chat:post`). Authors edit/delete their own messages; ADMIN (`chat:moderate`) removes others' with a reason, audited as `chat.message_removed`. Plain text, 2000 characters, 20 messages per person per minute. New messages arrive by polling every 8 s while the tab is visible (no push).

## Payment proof uploads and the reverse proxy

Proofs are stored in PostgreSQL (`qfinera_fund_contribution_proofs.data`), never on disk or behind a public URL, and served only through the authorized proof route. The app uploads them as `multipart/form-data` and shrinks large images in the browser to under ~900 KB, but a PDF can be up to 2 MB. Nginx rejects bodies over **1 MB by default** (HTTP 413) before the app sees them, so allow a little more for the QFinera API:

```
location /api/qfinera/ {
    client_max_body_size 4m;
    # ...existing proxy_pass settings
}
```

## Market data

There is no live market data and none is planned for this phase. Prices are recorded by the pool (`manual` provider) and labelled with their date and quality ("Recorded", "Closing price", "Recent", "Stale"); the UI never says "Live".

## Migrations

| File | Status |
|---|---|
| 006, 007 | Existing, unchanged |
| 008 `qfinera_fund_workflow` | Reviewed; required (trade lifecycle, NAV cutoff settings, watchlist fields) |
| 009 `qfinera_pools` | New; required (participation gate, `removed` memberships, pool-scoped append-only prices, one open withdrawal per member) |
| 010–014 | Auth, instrument master, positions/derivatives, proofs/corrections |
| 015 `qfinera_roles_approvals_deletion_watch` | VIEWER role, join requests, change requests, pool soft deletion + purge guard, platform role, Global Watch |
| 016 `qfinera_pool_chat` | Pool Chat messages |

All are additive, idempotent and transactional. Apply **manually**, in order, after a backup:

```
psql "$DATABASE_URL" -f db/migrations/008_qfinera_fund_workflow.sql
psql "$DATABASE_URL" -f db/migrations/009_qfinera_pools.sql
# ...
psql "$DATABASE_URL" -f db/migrations/015_qfinera_roles_approvals_deletion_watch.sql
psql "$DATABASE_URL" -f db/migrations/016_qfinera_pool_chat.sql
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
