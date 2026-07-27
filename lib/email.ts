/**
 * Provider-agnostic email sending.
 *
 * Swap the implementation inside sendEmail() when you pick a provider —
 * nothing calling this function needs to change.
 *
 * Resend example:
 *   const resend = new Resend(process.env.RESEND_API_KEY);
 *   await resend.emails.send({ from, to, subject, text });
 *
 * AWS SES example:
 *   const ses = new SESv2Client({ region: "ap-south-1" });
 *   await ses.send(new SendEmailCommand({ ... }));
 */

export type SendEmailInput = {
  to: string;
  from: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; error?: string }> {
  const provider = process.env.EMAIL_PROVIDER; // "resend" | "ses" | undefined

  if (!provider) {
    // No provider configured yet — log instead of failing silently in dev.
    console.log("[email:noop] Would send email:", input);
    return { ok: true };
  }

  if (provider === "resend") {
    // const { Resend } = await import("resend");
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // const { error } = await resend.emails.send({
    //   from: input.from,
    //   to: input.to,
    //   subject: input.subject,
    //   text: input.text,
    //   replyTo: input.replyTo,
    // });
    // if (error) return { ok: false, error: error.message };
    // return { ok: true };
    throw new Error("Resend provider selected but not yet wired up — uncomment the block in lib/email.ts");
  }

  if (provider === "ses") {
    throw new Error("SES provider selected but not yet wired up — implement using @aws-sdk/client-sesv2");
  }

  return { ok: false, error: `Unknown EMAIL_PROVIDER: ${provider}` };
}
