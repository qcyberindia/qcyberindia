// Reply-notification orchestration for QFinance Community. Deliberately
// small and focused: this is the one place that decides who gets emailed
// when a reply lands, and sends those emails. It does not implement a
// general notification platform — see qfinance.md for what's explicitly
// out of scope (push, DMs, followers, per-channel preferences).
import { getQFinanceReplyNotificationRecipients } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildQFinanceReplyNotificationEmail } from "@/lib/qfinance-beta-email";
import { qfinanceConfig } from "@/lib/qfinance-config";
import { siteConfig } from "@/lib/site-config";

const REPLY_PREVIEW_MAX_LEN = 160;

function truncatePreview(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= REPLY_PREVIEW_MAX_LEN) return trimmed;
  return trimmed.slice(0, REPLY_PREVIEW_MAX_LEN).trimEnd() + "\u2026";
}

/**
 * Sends a reply-notification email to the question's owner and every
 * previous (published) replier, excluding the person who just replied.
 * Recipient computation lives entirely in
 * `getQFinanceReplyNotificationRecipients` (lib/db.ts) — this function's
 * only job is turning that list into sent emails. Deduplication, self-
 * exclusion, and filtering out inactive/suspended users all happen at the
 * SQL layer (one query, `DISTINCT`, a `status = 'active'` join, and an
 * `id != actorUserId` filter) rather than being re-implemented here — see
 * that function's comment for why.
 *
 * Never trusts a recipient list from the caller: the only inputs are
 * `postId`, the reply's own id, the actor's id, and the reply body — all
 * of which the caller (the replies API route) has already derived
 * server-side from the verified session, never from client-supplied
 * recipient data.
 *
 * Intentionally does not throw. A failed notification should never be
 * able to affect the reply that already succeeded — the caller can still
 * wrap this in try/catch as defense in depth (see the replies route), but
 * this function itself never rejects; per-recipient send failures are
 * caught individually so one bad address can't stop the rest.
 */
export async function sendQFinanceReplyNotifications(
  postId: number,
  replyId: number,
  actorUserId: number,
  actorDisplayName: string,
  replyBody: string
): Promise<void> {
  let postTitle = "";
  let recipients: { id: number; email: string; display_name: string }[] = [];

  try {
    const result = await getQFinanceReplyNotificationRecipients(postId, actorUserId);
    postTitle = result.postTitle;
    recipients = result.recipients;
  } catch (err) {
    console.error("QFinance reply notifications: failed to compute recipients", { postId, replyId, err });
    return;
  }

  if (recipients.length === 0) return;

  const preview = truncatePreview(replyBody);
  const discussionUrl = `${qfinanceConfig.appUrl.replace(/\/$/, "")}/qfinera/community/${postId}`;

  // Skip anyone without a usable email rather than letting one bad row
  // fail the whole batch; each send is independently caught below too.
  const validRecipients = recipients.filter((r) => typeof r.email === "string" && r.email.includes("@"));

  const results = await Promise.allSettled(
    validRecipients.map((recipient) => {
      const { subject, text, html } = buildQFinanceReplyNotificationEmail({
        recipientName: recipient.display_name,
        replyAuthor: actorDisplayName,
        postTitle,
        replyPreview: preview,
        discussionUrl,
        // No mute-toggle endpoint exists yet, so no muteUrl is passed —
        // the template already supports it (renders nothing when absent)
        // for when that's built. Mute *checking* (excluding muted users
        // from `recipients` in the first place) is already live via
        // lib/db.ts's isQFinanceThreadMuted/setQFinanceThreadMute and the
        // recipient query's exclusion join — only the user-facing toggle
        // is the missing piece.
        supportEmail: siteConfig.email.support,
      });

      return sendEmail({
        to: recipient.email,
        from: `noreply@${qfinanceConfig.domain}`,
        subject,
        text,
        html,
      });
    })
  );

  results.forEach((result, i) => {
    const recipient = validRecipients[i];
    if (result.status === "rejected") {
      console.error("QFinance reply notification failed to send", {
        postId,
        replyId,
        recipientId: recipient.id,
        error: result.reason,
      });
    } else if (!result.value.ok) {
      console.error("QFinance reply notification failed to send", {
        postId,
        replyId,
        recipientId: recipient.id,
        error: result.value.error,
      });
    }
  });
}
