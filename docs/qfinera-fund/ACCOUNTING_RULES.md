# QFinera Fund: Accounting Rules

Status: Phase 1 foundation. Sections marked **OPEN** need a product decision before the phase that uses them.

## 1. Precision contract

| Quantity | Authoritative scale | Where rounded |
|---|---|---|
| Rupee amounts (cash, contributions, charges, expenses, gross/net) | 2 dp | At the accounting boundary (before storage) |
| NAV | 4 dp | When a NAV snapshot is produced |
| Units | 4 dp | When units are allocated or redeemed |
| Rounding residual | 8 dp (exact) | Never rounded; stored as computed |

- All arithmetic uses `Money` (`lib/accounting/money.ts`), a BigInt fixed-point value carried at an internal scale of 8 dp. No JavaScript `number` is used for authoritative values.
- Rounding mode is **HALF_UP, away from zero** (`lib/accounting/rounding.ts`). It happens once, at a boundary, via `Money.round()` or `toDecimalString()`.
- `Money.divide` truncates at 8 dp. Because the 4 dp half-point is representable at 8 dp, a later HALF_UP round to 4 dp equals rounding the true quotient; there is no double-rounding error.
- Database columns: `NUMERIC(20,2)` money, `NUMERIC(20,4)` NAV/units/prices/quantities, `NUMERIC(20,8)` residuals.

## 2. Units and residuals

- Contribution: `units = round4(amount / NAV)`; `residual = amount - units x NAV`.
- Withdrawal by units: `gross = round2(units x NAV)`; `residual = units x NAV - gross`.
- Residual sign: **positive = the fund keeps value; negative = the fund absorbs a shortfall.**
- The residual belongs to the Fund. No extra units are issued to absorb it. It is stored on the contribution/withdrawal row for reconciliation.
- **OPEN (Phase 4):** withdrawal by amount. The member is paid the approved amount and units are `round4(amount / NAV)`; the residual convention for that mode will be defined with the withdrawals module so the sign still means "positive = fund keeps".

## 3. Lifecycles

Contribution: `PENDING -> APPROVED -> AWAITING_NAV -> FINALIZED` (or `REJECTED` / `CANCELLED`)

- `APPROVED`: an ADMIN approved the request.
- `AWAITING_NAV`: funds confirmed received. Waiting for the next applicable EOD NAV.
- `FINALIZED`: units allocated at that NAV; ledger entry written. Only now are `nav_used`, `units_allocated`, `residual`, `effective_date`, `nav_snapshot_id`, and `finalized_at` populated. The database CHECK `..._lifecycle_check` forbids setting them earlier.

Withdrawal: `REQUESTED -> APPROVED -> AWAITING_NAV -> FINALIZED` (or `REJECTED` / `CANCELLED`). Same rule: nothing is redeemed before the applicable EOD NAV exists.

Units are never allocated or redeemed before the applicable EOD NAV exists.

## 4. Ledger

Entry types: `CONTRIBUTION, WITHDRAWAL, BUY, SELL, EXPENSE, ADJUSTMENT, REVERSAL`.

Sign rules (CHECK in migration 007, mirrored by `validateNewLedgerEntry`):

| Type | member | units_delta | cash_delta |
|---|---|---|---|
| CONTRIBUTION | required | > 0 | > 0 |
| WITHDRAWAL | required | < 0 | < 0 |
| BUY | none | 0 | < 0 |
| SELL | none | 0 | any |
| EXPENSE | none | 0 | < 0 |
| ADJUSTMENT / REVERSAL | any | any | any |

- Append-only: a trigger blocks UPDATE, DELETE, and TRUNCATE. Corrections are `REVERSAL` / `ADJUSTMENT` rows. A database owner can still drop the trigger, so this is defense in depth.
- One primary posting per source record: a unique index on `(reference_table, reference_id, entry_type)` for the five primary types prevents duplicate finalization.
- `accounting_version` (currently 1) records which posting rules produced an entry.

## 5. Invariants (`lib/accounting/invariants.ts`)

- Fund units = sum of member units.
- No member has negative units.
- Cash is never negative (hard fail, no temporary overdraft).
- Fund value = cash + holdings value + approved adjustments (compared at 2 dp).
- NAV = round4(fund value / outstanding units).
- No holding quantity is negative (no overselling).

Violations roll the transaction back; nothing is "fixed up" to pass a check.

## 6. Other approved rules (implemented in later phases)

- Initial NAV 10.0000; the Fund starts with zero capital and zero units.
- Trades affect cash and holdings on the trade date. Official NAV is struck at EOD.
- Approved expenses reduce Fund cash on their effective date and reach NAV through Fund value. They never change member units.
- Tax estimates are informational and never reduce NAV or change units. They display "ESTIMATE - NOT TAX ADVICE".
- XIRR uses actual member cash flows; unsolvable cases return N/A.
- Only ADMIN may backdate, via an explicit correction workflow that records a reason, a confirmation, an audit entry, and the preserved prior state.

## 7. Transactions and locking

Every NAV-affecting operation runs in `withTransaction` (`lib/db.ts`) and takes the fund lock first (`SELECT id FROM qfinera_funds WHERE id = $1 FOR UPDATE`) so concurrent contributions, withdrawals, and trades for one fund serialize.

## 8. Open questions

1. **Withdrawal charges (Phase 4):** is the cash that leaves the Fund the net amount, with the charge retained by the Fund, or the gross amount, with the charge paid to a third party? The ledger sign check only requires `cash_delta < 0`.
2. **First contribution NAV:** with no EOD NAV yet, does the first contribution use the initial NAV of 10.0000 on its next applicable EOD, or wait for a first snapshot at 10.0000? (Phase 3.)
3. **"Next applicable" EOD (Phase 3):** exact cutoff for what counts as the next EOD (for example, whether an approval after 4:00 PM IST on a trading day waits for the following day's NAV).
