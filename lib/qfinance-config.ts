// QFinance-specific config, kept separate from lib/site-config.ts so Qbids
// and the rest of QCyberIndia are never touched by QFinance changes.
import { siteConfig } from "@/lib/site-config";

export const qfinanceConfig = {
  name: "QFinance",
  path: "/qfinance",
  domain: siteConfig.domain,
  tagline: "Understand first. Invest second.",
  description:
    "QFinance helps first-time Indian investors understand how investing actually works — one clear idea at a time — before they put in a rupee.",
  email: siteConfig.email.info,
};
