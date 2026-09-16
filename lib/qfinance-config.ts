// QFinera brand config, kept separate from lib/site-config.ts so Qbids
// and the rest of QCyberIndia are never touched.
//
// Brand + route migration note (QFinera pivot — see qfinance.md): the
// product's public name changed from "QFinance" to "QFinera", AND the
// public route moved from /qfinance to /qfinera (see next.config.ts's
// permanent redirects covering every old /qfinance/* path). Database table
// names (qfinance_*), env var names (QFINANCE_AUTH_SECRET,
// QFINANCE_APP_URL), and internal file/module names deliberately still say
// "qfinance" — renaming those would be a production database-migration
// risk for zero user-facing benefit, since nothing about them is visible.
import { siteConfig } from "@/lib/site-config";

export const qfinanceConfig = {
  name: "QFinera",
  /** Prior public name — kept only for reference/compatibility copy
   * ("formerly QFinance"), never shown as the primary brand. */
  legacyName: "QFinance",
  path: "/qfinera",
  domain: siteConfig.domain,
  appUrl:
    process.env.QFINANCE_APP_URL ??
    (process.env.NODE_ENV === "production"
      ? `https://${siteConfig.domain}`
      : "http://localhost:3000"),
  tagline: "A New. Financial. Era.",
  description:
    "A private room for investors to discuss, record, research, and manage their own investment thinking.",
  email: siteConfig.email.info,
};
