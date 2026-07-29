import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { siteConfig } from "@/lib/site-config";

type ContactPayload = {
  name: string;
  email: string;
  company?: string;
  message: string;
  // honeypot field — real users never fill this in
  website?: string;
};

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  let body: ContactPayload;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  // Honeypot: bots fill every field, humans never see this one (hidden via CSS)
  if (body.website) {
    return NextResponse.json({ ok: true }); // silently accept, do nothing
  }

  const { name, email, company, message } = body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ ok: false, error: "Name, email, and message are required" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address" }, { status: 400 });
  }

  if (message.length > 5000) {
    return NextResponse.json({ ok: false, error: "Message is too long" }, { status: 400 });
  }

  const result = await sendEmail({
    to: siteConfig.email.info,
    from: `noreply@${siteConfig.domain}`,
    replyTo: email,
    subject: `New contact form submission from ${name}`,
    text: [
      `Name: ${name}`,
      `Email: ${email}`,
      company ? `Company: ${company}` : null,
      "",
      "Message:",
      message,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (!result.ok) {
  console.error("Email error:", result.error);

  return NextResponse.json(
    {
      ok: false,
      error: result.error ?? "Unknown email error",
    },
    { status: 502 }
  );
}

  return NextResponse.json({ ok: true });
}
