import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { insertQbidsRegistration, isDbConfigured } from "@/lib/db";
import { siteConfig } from "@/lib/site-config";

type QbidsRegistrationPayload = {
  name: string;
  company: string;
  email: string;
  phone: string;
  portals?: string[];
  challenge?: string;
  // honeypot field — real users never fill this in
  website?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  let body: QbidsRegistrationPayload;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  // Honeypot: bots fill every field, humans never see this one (hidden via CSS)
  if (body.website) {
    return NextResponse.json({ ok: true, duplicate: false }); // silently accept, do nothing
  }

  const { name, company, email, phone, portals, challenge } = body;

  if (!name?.trim() || !company?.trim() || !email?.trim() || !phone?.trim()) {
    return NextResponse.json(
      { ok: false, error: "Name, company, email, and phone are required" },
      { status: 400 }
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address" }, { status: 400 });
  }

  let duplicate = false;

  if (isDbConfigured()) {
    const dbResult = await insertQbidsRegistration({
      name: name.trim(),
      company: company.trim(),
      email: email.trim(),
      phone: phone.trim(),
      portals: portals ?? [],
      challenge: challenge?.trim(),
    });

    if (!dbResult.ok) {
      console.error("Qbids registration DB error:", dbResult.error);
      return NextResponse.json(
        { ok: false, error: "Something went wrong saving your registration. Please try again." },
        { status: 502 }
      );
    }

    duplicate = dbResult.duplicate;
  } else {
    console.warn("Qbids registration: DATABASE_URL not set — skipping persistence, email only.");
  }

  // Already registered — Don&apos;t notify by email again, just confirm to the user.
  if (duplicate) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const result = await sendEmail({
    to: siteConfig.email.info,
    from: `noreply@${siteConfig.domain}`,
    replyTo: email,
    subject: `🚀 New Qbids Beta Registration — ${company}`,
    text: [
      `Name: ${name}`,
      `Company: ${company}`,
      `Email: ${email}`,
      `Phone/WhatsApp: ${phone}`,
      portals && portals.length ? `Portals used: ${portals.join(", ")}` : "Portals used: (none selected)",
      challenge?.trim() ? `Primary bidding challenge: ${challenge.trim()}` : "",
      "",
      isDbConfigured()
        ? "Saved to qbids_registrations table."
        : "⚠️ Not saved to database — DATABASE_URL is not configured yet.",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (!result.ok) {
    console.error("Qbids registration email error:", result.error);
    // The registration is already saved in the DB at this point (if configured),
    // so we Don&apos;t want to fail the whole request just because the notification
    // email didn't send — that would be misleading to the person signing up.
    if (!isDbConfigured()) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "Unknown email error" },
        { status: 502 }
      );
    }
  }

  return NextResponse.json({ ok: true, duplicate: false });
}
