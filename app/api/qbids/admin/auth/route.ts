import { NextResponse } from "next/server";

// Retired. This endpoint used to be an independent Qbids-only login,
// separate from the centralized QCyberIndia Admin auth. There is now only
// one admin login system: POST /api/admin/auth (see lib/admin-auth.ts).
// This route is kept in place (rather than removed) only so that anything
// still pointing at the old URL gets a clear, honest answer instead of a
// generic 404 - it can no longer check a password or issue a session
// under any circumstance.
const RETIRED_RESPONSE = {
  ok: false,
  error: "This endpoint has been retired. Use POST /api/admin/auth instead.",
};

export async function POST() {
  return NextResponse.json(RETIRED_RESPONSE, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json(RETIRED_RESPONSE, { status: 410 });
}
