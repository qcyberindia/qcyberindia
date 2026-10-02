# QFinera Pools: Legal and Product Gate

Status: **PRIVATE, INVITE-ONLY.** This is a product boundary, not legal advice.

## What QFinera Pools is

Software for a small private group of people who know each other to keep the books of their own pooled money: contributions, units and NAV, trades they place themselves at their own broker, holdings, expenses, withdrawals, reports and an audit trail.

## What it deliberately does not do

- **No custody.** QFinera never holds, receives or moves money or securities. Contributions and withdrawals are bank transfers the members make themselves; QFinera only records them.
- **No public solicitation.** Pools are never listed, searchable or discoverable. Joining requires a single-use invite link bound to the invitee's email.
- **No advice, signals or copy trading.** The watchlist is shared research notes. There are no recommendations, targets, alerts or automated trades.
- **No guaranteed or projected returns.** Figures shown are recorded history. XIRR and tax estimates are labelled informational.
- **No commercial fund management.** No fees to QFinera, no performance fees, no manager compensation features.

## How the gate is enforced

| Control | Where |
|---|---|
| `participation_mode` can only be `PRIVATE_INVITE_ONLY` | Database CHECK, `db/migrations/009_qfinera_pools.sql` |
| Creator must confirm the private-pool acknowledgement | `createPool` (server-side), `lib/fund/product-gate.ts` |
| Invite-only membership; invite bound to email; single use; expires | `lib/fund/services/invites.ts` |
| Member and pool-creation limits | `MAX_POOL_MEMBERS`, `MAX_POOLS_CREATED_PER_USER` in `lib/fund/product-gate.ts` |
| No pool directory or public pool page | Only `/qfinera/pools` for the signed-in user's own pools |

The limits are product limits chosen to keep pools small and personal. They are **not** a statement of any legal threshold.

## Before enabling anything broader

Any of the following needs a separate, India-specific legal and regulatory review **before** it is built or switched on (for example, against the laws and regulations that govern collective investment schemes, alternative investment funds, portfolio management, investment advice, deposits, and payments):

- participation by people who were not personally invited, or any public listing or marketing of pools;
- QFinera receiving, holding or transferring money or securities;
- fees, profit shares or compensation for a pool manager or for QFinera;
- recommendations, signals, copy trading or automated execution;
- larger pools than the configured limits.

Activating any of these requires a new migration that relaxes the `participation_mode` CHECK. That change must reference the completed review.
