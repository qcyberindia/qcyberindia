// Product / legal gate for QFinera Pools. Pure constants; no I/O.
//
// QFinera Pools is PRIVATE, INVITE-ONLY pool-management software for people
// who already know each other. It records and accounts for a group's own
// pooled money; it does not hold money (no custody), solicit the public,
// promise returns, copy trades, or give investment advice.
//
// Public or commercial real-money participation is NOT a configuration
// switch. The database itself only allows participation_mode =
// 'PRIVATE_INVITE_ONLY' (CHECK in migration 009). Activating anything
// broader requires a separate India-specific legal and regulatory review
// first (see docs/qfinera-fund/LEGAL_GATE.md), then a new migration.

export const PARTICIPATION_MODE = "PRIVATE_INVITE_ONLY" as const;

/** Product limit (not a legal threshold): members per pool, active or suspended. */
export const MAX_POOL_MEMBERS = 25;

/** Product limit: pools one person may create, to keep pools small and personal. */
export const MAX_POOLS_CREATED_PER_USER = 5;

/** Invite links expire after this many days and work once. */
export const INVITE_TTL_DAYS = 7;

/** Shown when a pool is created and in the workspace footer. */
export const PRIVATE_POOL_NOTICE =
  "QFinera Pools is private, invite-only record-keeping and accounting software for a group's own money. " +
  "QFinera does not hold funds, solicit investors, guarantee returns or give investment advice. " +
  "Tax figures are estimates only. QFinera has no live market data: prices are recorded by the pool and labelled with their date.";

/** What the creator must confirm before a pool exists. */
export const CREATE_POOL_ACKNOWLEDGEMENT =
  "I confirm this pool is private and invite-only, for people I know personally; it will not be advertised or " +
  "offered to the public, and QFinera does not hold, manage or guarantee the money.";
