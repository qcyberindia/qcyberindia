// Transactional emails for QFinera accounts. Plain text, no tracking.
// Links carry a one-time token; the email never contains a password.
import { sendEmail } from "@/lib/email";
import { qfinanceConfig } from "@/lib/qfinance-config";

function appUrl(path: string): string {
  return `${qfinanceConfig.appUrl.replace(/\/$/, "")}${path}`;
}

async function deliver(to: string, subject: string, text: string, link: string | null): Promise<void> {
  const result = await sendEmail({ to, from: `noreply@${qfinanceConfig.domain}`, subject, text });
  if (!result.ok) {
    if (process.env.NODE_ENV !== "production" && link) {
      // Local development only: email is not configured, so show the link to the developer.
      console.warn(`QFinera email not sent (${result.error}). Development link for ${to}: ${link}`);
    } else {
      console.error("QFinera email could not be sent:", result.error);
    }
  }
}

export async function sendVerifyEmail(to: string, name: string, token: string): Promise<void> {
  const link = appUrl(`/qfinera/verify-email?token=${encodeURIComponent(token)}`);
  await deliver(
    to,
    "Confirm your QFinera account",
    `Hello ${name},\n\nConfirm your email to finish creating your QFinera account:\n${link}\n\n` +
      "You'll be asked for the password you just chose. The link works once and expires in 24 hours.\n\n" +
      "If you didn't create a QFinera account, ignore this email; nothing happens without the password.",
    link
  );
}

export async function sendAlreadyRegisteredEmail(to: string, name: string): Promise<void> {
  const link = appUrl("/qfinera/login");
  await deliver(
    to,
    "You already have a QFinera account",
    `Hello ${name},\n\nSomeone (hopefully you) tried to create a QFinera account with this email, but you already have one.\n\n` +
      `Sign in: ${link}\nForgot your password? ${appUrl("/qfinera/forgot-password")}\n\nIf this wasn't you, you can ignore this email.`,
    link
  );
}

export async function sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
  const link = appUrl(`/qfinera/reset-password?token=${encodeURIComponent(token)}`);
  await deliver(
    to,
    "Set or reset your QFinera password",
    `Hello ${name},\n\nUse this link to choose a new QFinera password:\n${link}\n\n` +
      "It works once and expires in 30 minutes. Setting a password signs you out everywhere.\n\n" +
      "If you didn't ask for this, ignore this email; your password stays the same.",
    link
  );
}

export async function sendPasswordChangedEmail(to: string, name: string): Promise<void> {
  await deliver(
    to,
    "Your QFinera password was changed",
    `Hello ${name},\n\nYour QFinera password was just changed and all other sessions were signed out.\n\n` +
      `If this wasn't you, reset your password now: ${appUrl("/qfinera/forgot-password")}`,
    null
  );
}
