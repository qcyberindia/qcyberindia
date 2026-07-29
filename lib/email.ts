import { Resend } from "resend";

export type SendEmailInput = {
  to: string;
  from: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export async function sendEmail(
  input: SendEmailInput
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      ok: false,
      error: "RESEND_API_KEY is not configured.",
    };
  }

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      from: "QCyberIndia <info@qcyberindia.com>",
      to: input.to,
      subject: input.subject,
      text: input.text,
      replyTo: input.replyTo,
    });

    if (error) {
      return {
        ok: false,
        error: error.message,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}