import { NextRequest, NextResponse } from "next/server";
import { getOrCreateQFinanceUser, isDbConfigured } from "@/lib/db";
import { createMagicLinkToken } from "@/lib/qfinance-community-auth";
import { sendEmail } from "@/lib/email";
import { siteConfig } from "@/lib/site-config";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Requests a magic-link sign-in email for QFinance Community. Same
// operation whether the email is new or returning — no separate "sign up"
// endpoint, since there's no password to set.
export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: "Community sign-in isn't available yet." }, { status: 503 });
  }

  let body: { email?: string; displayName?: string; website?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (body.website) {
    // honeypot — pretend success, do nothing
    return NextResponse.json({ ok: true });
  }

  const email = body.email?.trim() ?? "";
  const displayName = body.displayName?.trim() ?? "";

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address" }, { status: 400 });
  }
  if (!displayName) {
    return NextResponse.json({ ok: false, error: "Enter a display name" }, { status: 400 });
  }

  const user = await getOrCreateQFinanceUser(email, displayName);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }

  const token = createMagicLinkToken(user.email, user.display_name);
  if (!token) {
    console.error("QFinance community auth: QFINANCE_AUTH_SECRET is not configured.");
    return NextResponse.json({ ok: false, error: "Community sign-in isn't configured yet." }, { status: 503 });
  }

  const verifyUrl = `https://${siteConfig.domain}/api/qfinance/community/auth/verify?token=${token}`;

  const result = await sendEmail({
    to: user.email,
    from: `noreply@${siteConfig.domain}`,
    subject: "Sign in to QFinance Community",
    text: [
      `Hi ${user.display_name},`,
      "",
      "Click the link below to sign in to QFinance Community. It expires in 15 minutes.",
      "",
      verifyUrl,
      "",
      "If you didn't request this, you can ignore this email.",
    ].join("\n"),
  });

  if (!result.ok) {
    // Dev/local fallback ONLY — never log a raw magic-link token in
    // production. If email delivery fails in prod, the request still
    // returns ok (below) so the endpoint doesn't reveal whether an email
    // exists; the failure is recorded without the token so it's still
    // debuggable from logs/metrics.
    if (process.env.NODE_ENV !== "production") {
      console.warn("QFinance community magic link email failed to send:", result.error);
      console.warn("Magic link (dev fallback):", verifyUrl);
    } else {
      console.error("QFinance community magic link email failed to send:", result.error);
    }
  }

  return NextResponse.json({ ok: true });
}
