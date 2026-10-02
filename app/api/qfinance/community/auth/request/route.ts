import { NextResponse } from "next/server";

// Email-link sign-in has been replaced by email + password. Existing accounts
// keep their identity and set a password through "Forgot password".
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Email-link sign-in has been replaced. Sign in with your password, or use Forgot password to set one.",
    },
    { status: 410 }
  );
}
