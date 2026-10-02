import type { NextRequest } from "next/server";
import { sendEmail } from "@/lib/email";
import { readDb } from "@/lib/fund/db";
import { jsonOk } from "@/lib/fund/http";
import { poolRoute, type PoolParams } from "@/lib/fund/pool-http";
import { INVITE_TTL_DAYS } from "@/lib/fund/product-gate";
import type { FundRole } from "@/lib/fund/rbac";
import { createInvite, listInvites } from "@/lib/fund/services/invites";
import { parseEmail, parseEnum, readJsonObject } from "@/lib/fund/validation";
import { qfinanceConfig } from "@/lib/qfinance-config";

const ROLES: readonly FundRole[] = ["ADMIN", "MANAGER", "MEMBER"];

export async function GET(req: NextRequest, { params }: PoolParams) {
  return poolRoute(req, params, async ({ sctx }) => jsonOk({ invites: await listInvites(readDb(), sctx) }));
}

/**
 * Create an invite. The link (containing the one-time token) is emailed to
 * the invitee when email is configured, and returned ONCE to the inviter so
 * they can share it directly. Only a hash of the token is stored.
 */
export async function POST(req: NextRequest, { params }: PoolParams) {
  return poolRoute(
    req,
    params,
    async ({ req, ctx, sctx }) => {
      const body = await readJsonObject(req);
      const { invite, token } = await createInvite(sctx, {
        email: parseEmail(body.email),
        role: parseEnum(body.role ?? "MEMBER", "role", ROLES),
      });
      const link = `${qfinanceConfig.appUrl.replace(/\/$/, "")}/qfinera/pools/join?token=${encodeURIComponent(token)}`;
      const sent = await sendEmail({
        to: invite.email,
        from: `noreply@${qfinanceConfig.domain}`,
        subject: `${ctx.displayName} invited you to a private QFinera pool`,
        text:
          `${ctx.displayName} invited you to join "${ctx.fund.name}", a private, invite-only pool on QFinera.\n\n` +
          `Sign in to QFinera with this email address, then open:\n${link}\n\n` +
          `The link works once and expires in ${INVITE_TTL_DAYS} days. QFinera does not hold money or give investment advice.\n` +
          `If you were not expecting this, ignore this email.`,
      });
      return jsonOk({ invite, link, emailSent: sent.ok }, 201);
    },
    { mutation: true }
  );
}
