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

Entry types: `CONTRIBUTION, WITHDRAWAL, BUY, SELL, EXPENSE, ADJUSTMENT, REVERSAL, TRADE_MTM` (`TRADE_MTM` added in migration 012, see section 10).

Sign rules (CHECK in migration 007, extended in 012, mirrored by `validateNewLedgerEntry`):

| Type | member | units_delta | cash_delta |
|---|---|---|---|
| CONTRIBUTION | required | > 0 | > 0 |
| WITHDRAWAL | required | < 0 | < 0 |
| BUY | none | 0 | < 0 |
| SELL | none | 0 | any |
| EXPENSE | none | 0 | < 0 |
| TRADE_MTM | none | 0 | any (including 0) |
| ADJUSTMENT / REVERSAL | any | any | any |

- Append-only: a trigger blocks UPDATE, DELETE, and TRUNCATE. Corrections are `REVERSAL` / `ADJUSTMENT` rows. A database owner can still drop the trigger, so this is defense in depth.
- One primary posting per source record: a unique index on `(reference_table, reference_id, entry_type)` for the six primary types (including `TRADE_MTM`) prevents duplicate finalization.
- `accounting_version` (currently 1) records which posting rules produced an entry.

## 5. Invariants (`lib/accounting/invariants.ts`)

- Fund units = sum of member units.
- No member has negative units.
- Cash is never negative (hard fail, no temporary overdraft).
- Fund value = cash + value of open positions + approved adjustments (compared at 2 dp). A position's value is signed (section 10).
- NAV = round4(fund value / outstanding units).
- No position closes more than is open (no overselling a long, no over-covering a short), and no position changes side in one execution. A SELL does NOT require a holding when it opens a short (section 10).

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

## 10. Trades, positions and products (migration 012)

A **trade** is one execution: side (BUY/SELL), quantity, price, charges. A **position** is the exposure executions build, keyed by **(pool, instrument, product)**. Positions are derived by replaying executed trades in (trade date, id) order (`lib/accounting/positions.ts`); they are never stored, so they always reconcile with the ledger.

### Products and position actions

| Product | Instrument | Directions | Cash settlement |
|---|---|---|---|
| `EQUITY_DELIVERY` | EQUITY | long only | PREMIUM |
| `EQUITY_INTRADAY` | EQUITY | long and short | MTM |
| `FUTURES` | FUTURE contract | long and short | MTM |
| `OPTIONS` | OPTION contract | long and short | PREMIUM |

Each trade carries a `position_action`; the side follows from it and a CHECK enforces the pairing:

| Action | Side |
|---|---|
| `OPEN_LONG` | BUY |
| `CLOSE_LONG` | SELL |
| `OPEN_SHORT` | SELL |
| `CLOSE_SHORT` | BUY |

Delivery is long-only (CHECK). Pre-012 trades were backfilled as `EQUITY_DELIVERY` with BUY → `OPEN_LONG` and SELL → `CLOSE_LONG`, which is exactly how they were accounted before. The API still accepts a side-only request for delivery. For every other product the action is required: a SELL is never assumed to close, or open, anything.

### Position rules

- **Average cost.** Opening charges are capitalized into the position. Closing charges reduce the proceeds (long) or add to the buy-back cost (short).
- **Partial close** removes `round2(basis × closeQty / openQty)` of the basis. A **full close** removes all of it, so a closed position has no residue.
- **Open / increase:** only on a flat position or one in the same direction.
- **Close:** never more than the open quantity.
- **Reverse:** never in one execution. Close, then open the other side (two executions).
- **Realized P&L, long:** `(gross − close charges) − basis removed`, where basis is entry value + capitalized charges.
- **Realized P&L, short:** `basis removed − (gross + close charges)`, where basis is entry value − capitalized charges.
- **Unrealized P&L** at a price: long = `qty × price − basis`; short = `basis − qty × price`.
- Example: SHORT 100 @ 1,520, then BUY 40 @ 1,500 books (1,520 − 1,500) × 40 = 800 and leaves SHORT 60 @ 1,520. Then BUY 60 @ 1,490 books (1,520 − 1,490) × 60 = 1,800 and closes the position. Total 2,600.
- Equity delivery gives the same quantities, cost basis and realized P&L as the original `applyBuy` / `applySell`, to the paisa (unit-tested).

### Cash (the decision recorded for 012)

There is no margin or leverage model. Short proceeds are never available as free cash, except an option writer's premium (below).

| Settlement | Open | Close |
|---|---|---|
| **PREMIUM** (delivery, options) | BUY: cash −= gross + charges. SELL (short option): cash += gross − charges. Ledger `BUY`/`SELL`. | SELL: cash += gross − charges. BUY (cover short option): cash −= gross + charges. |
| **MTM** (intraday, futures) | cash −= charges only (may be 0). Ledger `TRADE_MTM`. | cash += price difference on the closed quantity − charges (either sign). |

Because an MTM close's cash is fixed from the open it closes, two operations are refused if a LATER execution exists on the same MTM position: inserting an earlier execution (backdating), and reversing an execution. The later trades must be reversed first. PREMIUM products keep the original rule (any order is valid if the replay never oversells).

Cash is never negative, as before (checked from the trade date onward).

### NAV impact

Fund Value = cash + Σ position value + adjustments:

| Position | Value at the official EOD price |
|---|---|
| Delivery long, option long | + qty × price (an asset) |
| Option short | − qty × price (a liability) |
| Intraday / futures | the unrealized price difference: long `qty × price − entry value`; short `entry value − qty × price` (opening charges already left cash) |

**An `EQUITY_INTRADAY` position still open at the end of a day blocks that day's NAV.** The square-off, or the broker's auto square-off, must be recorded first.

- **Existing pools:** delivery-only history values exactly as before, so there is no change to any existing NAV.
- Every open position needs an EOD/MANUAL price on the NAV date, as before. The NAV audit entry now records product, direction and value for each line.

### Instruments

`qfinera_fund_instruments.instrument_type` is EQUITY (default), FUTURE or OPTION. A CHECK requires:

- `underlying_symbol` and `expiry_date` on derivatives;
- `strike_price > 0` and `option_type` CE/PE on options;
- none of these on EQUITY rows, so an equity master row can never stand in for a contract.

Each contract is unique per (exchange, underlying, expiry, type, strike, CE/PE). Its symbol is generated in exchange style (`NIFTY26NOV2026FUT`, `NIFTY26NOV202625000CE`). Quantity is in units. When `lot_size` is set, derivative quantities must be whole lots. A derivative cannot be traded after its expiry date. Expiry settlement and exercise are recorded as closing trades at the settlement price; they are not automated.

### Reporting metrics (new; existing reports unchanged)

`reports?type=positions` returns these metrics. The holdings and positions API returns them too.

- **Realized P&L:** booked by closing executions, net of all charges, per product and in total.
- **Unrealized P&L:** open positions at the latest display price (not the official NAV price).
- **Trading charges:** the sum of every executed trade's charge components.
- **Long / short exposure:** notional (qty × price) of open long / short positions. Options count at premium value, not delta-adjusted.
- **Gross exposure** = long + short. **Net exposure** = long − short.
- **Tax estimate:** now uses `EQUITY_DELIVERY` trades only. In India, intraday equity is speculative business income and F&O is non-speculative business income, so neither is folded into capital gains; it appears as realized trading P&L.

