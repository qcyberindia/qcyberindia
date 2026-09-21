// Branded transactional emails for QFinera. Table-based layout + inline
// styles throughout, since email clients don't reliably support external/
// modern CSS. Colors are hardcoded to match app/qfinera/layout.tsx's
// light-theme tokens (--qf-cream-0, --qf-brass, --qf-ink, etc.) since CSS
// variables aren't usable in email HTML.

const COLORS = {
  cream0: "#FBF8F1",
  cream1: "#F3EDDD",
  brass: "#A8863E",
  brassDark: "#7C6329",
  ink: "#2B2621",
  inkSoft: "#5B5347",
  line: "#D8CBA9",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Shared header block — reused by every QFinera transactional email so
// they read as one product, not a collection of one-off templates.
function emailHeader() {
  return `
          <tr>
            <td style="padding: 32px 32px 20px; border-bottom: 1px solid ${COLORS.line};">
              <div style="font-size: 22px; font-weight: 600; color: ${COLORS.ink}; letter-spacing: -0.01em;">
                Q<span style="color: ${COLORS.brass};">Finera</span>
              </div>
              <div style="margin-top: 4px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: ${COLORS.brassDark};">
                A New. Financial. Era.
              </div>
            </td>
          </tr>`;
}

function emailFooter(supportEmail: string) {
  return `
          <tr>
            <td style="padding: 22px 32px; border-top: 1px solid ${COLORS.line}; font-family: Arial, Helvetica, sans-serif;">
              <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: ${COLORS.ink};">QFinera</p>
              <p style="margin: 0 0 12px; font-size: 12px; color: ${COLORS.inkSoft};">A product by QCyberIndia</p>
              <p style="margin: 0; font-size: 12px; color: ${COLORS.inkSoft};">
                Questions? Write to <a href="mailto:${supportEmail}" style="color: ${COLORS.brassDark};">${supportEmail}</a>
              </p>
            </td>
          </tr>`;
}

function emailShell(bodyRows: string, subject: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${subject}</title>
</head>
<body style="margin:0; padding:0; background-color:${COLORS.cream1}; font-family: Georgia, 'Times New Roman', serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.cream1}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color:${COLORS.cream0}; border: 1px solid ${COLORS.line}; border-radius: 8px; overflow: hidden;">
${bodyRows}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildQFinanceBetaEmail({
  name,
  communityUrl,
  supportEmail,
}: {
  name: string;
  communityUrl: string;
  supportEmail: string;
}): { subject: string; text: string; html: string } {
  const safeName = escapeHtml(name.trim() || "there");
  const firstName = safeName.split(/\s+/)[0];

  const subject = "Welcome to the QFinera Beta — Registration Confirmed";

  const text = [
    `Hi ${firstName},`,
    "",
    "Your request to join the QFinera beta has been received.",
    "",
    "QFinera is building a private community where investors can ask questions, discuss ideas, research companies, record their thinking, and learn from other investors.",
    "",
    "What happens next:",
    "1. Your registration has been recorded.",
    "2. We are preparing the beta community.",
    "3. You'll receive another email when your access is ready.",
    "",
    `In the meantime, explore the QFinera Community: ${communityUrl}`,
    "",
    "— QFinera, a product by QCyberIndia",
    `Questions? ${supportEmail}`,
  ].join("\n");

  const body = `
          <tr>
            <td style="padding: 32px; font-family: Arial, Helvetica, sans-serif;">
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: ${COLORS.ink};">
                Hi ${firstName},
              </p>
              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: ${COLORS.ink};">
                <strong>Your request to join the QFinera beta has been received.</strong>
              </p>
              <p style="margin: 0 0 24px; font-size: 14.5px; line-height: 1.65; color: ${COLORS.inkSoft};">
                QFinera is building a private community where investors can ask questions, discuss
                ideas, research companies, record their thinking, and learn from other investors.
              </p>

              <!-- Status box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.cream1}; border: 1px solid ${COLORS.line}; border-radius: 6px; margin: 0 0 28px;">
                <tr>
                  <td style="padding: 20px 22px;">
                    <p style="margin: 0 0 10px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${COLORS.brassDark};">
                      What happens next
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif;">
                      <tr>
                        <td style="padding: 4px 10px 4px 0; font-size: 14px; color: ${COLORS.brass}; vertical-align: top;">1.</td>
                        <td style="padding: 4px 0; font-size: 14px; line-height: 1.5; color: ${COLORS.ink};">Your registration has been recorded.</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 10px 4px 0; font-size: 14px; color: ${COLORS.brass}; vertical-align: top;">2.</td>
                        <td style="padding: 4px 0; font-size: 14px; line-height: 1.5; color: ${COLORS.ink};">We are preparing the beta community.</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 10px 4px 0; font-size: 14px; color: ${COLORS.brass}; vertical-align: top;">3.</td>
                        <td style="padding: 4px 0; font-size: 14px; line-height: 1.5; color: ${COLORS.ink};">You&#39;ll receive another email when your access is ready.</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius: 4px; background-color: ${COLORS.brass};">
                    <a href="${communityUrl}" style="display: inline-block; padding: 13px 26px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; color: ${COLORS.cream0}; text-decoration: none;">
                      Explore the QFinera Community
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;

  const html = emailShell(emailHeader() + body + emailFooter(supportEmail), subject);

  return { subject, text, html };
}

// Magic-link sign-in email — previously plain text only, with the raw
// verification URL exposed as visible body copy. Now matches the beta
// email's branded shell; the token URL lives only inside the CTA button's
// href, never as rendered text in the HTML body. The plain-text
// alternative still includes the URL directly, since a text-only client
// has no other way to present a clickable action — that's a different,
// expected exposure (a link a person asked for, in a client they chose to
// read plain text in), not the bug being fixed here.
export function buildQFinanceMagicLinkEmail({
  displayName,
  verifyUrl,
  supportEmail,
}: {
  displayName: string;
  verifyUrl: string;
  supportEmail: string;
}): { subject: string; text: string; html: string } {
  const safeName = escapeHtml(displayName.trim() || "there");
  const firstName = safeName.split(/\s+/)[0];

  const subject = "Sign in to QFinera Community";

  const text = [
    `Hi ${firstName},`,
    "",
    "Use the link below to sign in to QFinera Community. It securely signs you in — no password needed.",
    "",
    verifyUrl,
    "",
    "This link expires in 15 minutes and can only be used once.",
    "",
    "If you didn't request this, you can safely ignore this email — no account changes will be made.",
    "",
    "— QFinera, a product by QCyberIndia",
    `Questions? ${supportEmail}`,
  ].join("\n");

  const body = `
          <tr>
            <td style="padding: 32px; font-family: Arial, Helvetica, sans-serif;">
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: ${COLORS.ink};">
                Hi ${firstName},
              </p>
              <p style="margin: 0 0 24px; font-size: 14.5px; line-height: 1.65; color: ${COLORS.inkSoft};">
                You (or someone using this email) asked to sign in to <strong style="color: ${COLORS.ink};">QFinera Community</strong>.
                Use the button below to sign in securely \u2014 no password needed.
              </p>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 0 24px;">
                <tr>
                  <td style="border-radius: 4px; background-color: ${COLORS.brass};">
                    <a href="${verifyUrl}" style="display: inline-block; padding: 14px 30px; font-family: Arial, Helvetica, sans-serif; font-size: 14.5px; font-weight: 700; color: ${COLORS.cream0}; text-decoration: none;">
                      Sign in to QFinera
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry / security note -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${COLORS.cream1}; border: 1px solid ${COLORS.line}; border-radius: 6px; margin: 0 0 20px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; font-size: 13px; line-height: 1.55; color: ${COLORS.inkSoft};">
                      This link expires in <strong style="color: ${COLORS.ink};">15 minutes</strong> and can only be used once.
                      For your security, we never ask for a password \u2014 just this link.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: ${COLORS.inkSoft};">
                If you didn&#39;t request this, you can safely ignore this email \u2014 no changes will be made to your account.
              </p>
            </td>
          </tr>`;

  const html = emailShell(emailHeader() + body + emailFooter(supportEmail), subject);

  return { subject, text, html };
}
