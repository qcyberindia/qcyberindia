import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { insertQFinanceRegistration, isDbConfigured } from "@/lib/db";
import { siteConfig } from "@/lib/site-config";

// Public registration endpoint for /qfinance/beta. Mirrors app/api/qbids/route.ts's
// pattern (honeypot, validation, duplicate-is-not-an-error, DB-first-then-email)
// deliberately, rather than inventing a second convention — but the payload
// is deliberately minimal (name + email only), matching qfinance_registrations'
// schema. Add fields here only if a real product requirement justifies them.
type QFinanceRegistrationPayload = {
  name: string;
  email: string;
  // honeypot field — real users never fill this in
  website?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  let body: QFinanceRegistrationPayload;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (body.website) {
    return NextResponse.json({ ok: true, duplicate: false }); // honeypot: silently accept, do nothing
  }

  const { name, email } = body;

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ ok: false, error: "Name and email are required" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address" }, { status: 400 });
  }

  let duplicate = false;

  if (isDbConfigured()) {
    const dbResult = await insertQFinanceRegistration({ name: name.trim(), email: email.trim() });

    if (!dbResult.ok) {
      console.error("QFinance registration DB error:", dbResult.error);
      return NextResponse.json(
        { ok: false, error: "Something went wrong saving your registration. Please try again." },
        { status: 502 }
      );
    }

    duplicate = dbResult.duplicate;
  } else {
    console.warn("QFinance registration: DATABASE_URL not set — skipping persistence, email only.");
  }

  if (duplicate) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const result = await sendEmail({
    to: siteConfig.email.info,
    from: `noreply@${siteConfig.domain}`,
    replyTo: email,
    subject: `📈 New QFinance Beta Registration — ${name}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      "",
      isDbConfigured()
        ? "Saved to qfinance_registrations table."
        : "⚠️ Not saved to database — DATABASE_URL is not configured yet.",
    ].join("\n"),
  });

  if (!result.ok) {
    console.error("QFinance registration email error:", result.error);
    if (!isDbConfigured()) {
      return NextResponse.json({ ok: false, error: result.error ?? "Unknown email error" }, { status: 502 });
    }
  }

  return NextResponse.json({ ok: true, duplicate: false });
}
