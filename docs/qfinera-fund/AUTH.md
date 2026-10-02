# QFinera Accounts and Sessions

## Identity
`qfinance_users` is the one user table, shared by Community, Learn progress and Pools. No second user table exists.

## Registration → confirmation → sign-in
1. `/qfinera/register`: display name, email, password (min 10 chars, not containing the email name), confirmation, consent.
2. The response is identical whether or not the email is registered (no account enumeration). Already-verified accounts get an "you already have an account" email instead.
3. The confirmation email links to `/qfinera/verify-email`. The person re-enters the password they chose. The password hash travels in the single-use token (`pending_password_hash`) and is applied only then, so someone who pre-registers your address can never take the account.
4. Confirmation signs the user in.

## Passwords
scrypt (N = 2^17, r = 8, p = 1, 16-byte salt, 64-byte key), parameters stored in each hash; `needsRehash` upgrades on sign-in. Plaintext is never stored or logged. Argon2id was not used because Node 22 has no built-in Argon2 and a native module was not added.

## Sessions
- Cookie `qf_sid`: 32 random bytes, `HttpOnly`, `SameSite=Lax`, `Secure` in production, no personal data.
- Database stores only SHA-256 of the token, with an **absolute 30-day expiry** (activity does not extend it).
- New token at every sign-in; the token presented before sign-in is revoked (session fixation).
- Revoked on: sign-out, password change (all, then a fresh one is issued), password reset (all), suspension, admin "sign out everywhere", user "sign out other devices".
- Only active accounts' sessions are valid. Old stateless `qf_session` cookies are ignored.

## Password reset
`/qfinera/forgot-password` always answers the same. Active accounts receive a single-use, hashed, 30-minute link; only the newest link works. Reset sets the password, confirms the email, revokes every session and asks the user to sign in again. Accounts created by the retired email-link sign-in set their first password this way; their identity and history are unchanged.

## Rate limits (per 15 min unless stated)
Sign-in: 40 per IP; 8 failures per email lock that email's sign-in for the window. Registration: 10/hour per IP, 3/hour per email. Reset requests: 10/hour per IP, 3/hour per email. Token use: 30 per IP. Admin login: 10 failures per IP.

## Admin
`/admin/qfinance/users` (existing QCyberIndia admin login): users, verification, last login, pools, sessions; suspend/restore, sign out everywhere, email a reset link. Admins never see passwords, hashes or tokens. Actions are recorded in the append-only `qfinance_admin_audit`.

## Migration
`db/migrations/010_qfinera_password_auth.sql`: additive, idempotent, one transaction. Apply manually after 008 and 009. Deploying the code before 010 is applied breaks sign-in, so apply 010 first.
