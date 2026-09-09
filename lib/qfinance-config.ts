// QFinance-specific config, kept separate from lib/site-config.ts so Qbids
// and the rest of QCyberIndia are never touched.
import { siteConfig } from "@/lib/site-config";

export const qfinanceConfig = {
  name: "QFinance",
  path: "/qfinance",
  domain: siteConfig.domain,
  appUrl:
    process.env.QFINANCE_APP_URL ??
    (process.env.NODE_ENV === "production"
      ? `https://${siteConfig.domain}`
      : "http://localhost:3000"),
  tagline: "Understand first. Invest second.",
  description:
    "QFinance helps first-time Indian investors understand how investing actually works — one clear idea at a time — before they put in a rupee.",
  email: siteConfig.email.info,
};