import type { Metadata } from "next";
import { Red_Hat_Display, Red_Hat_Text, Red_Hat_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Analytics from "@/components/Analytics";
import PromiseBanner from "@/components/PromiseBanner";
import { siteConfig } from "@/lib/site-config";

// Type system: Red Hat Display / Text / Mono — one cohesive family from an
// enterprise open-source infrastructure company, not three fonts picked for
// looks alone. Fits a brand whose whole pitch is "we take ownership of your
// infrastructure" more honestly than a generic geometric-sans pairing would.
const redHatDisplay = Red_Hat_Display({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-redhat-display",
  display: "swap",
});

const redHatText = Red_Hat_Text({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-redhat-text",
  display: "swap",
});

const redHatMono = Red_Hat_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-redhat-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${siteConfig.domain}`),
  title: {
    default: `${siteConfig.name} — Remote IT Partner for Startups, MSMEs & Educational Institutions`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: { icon: "/logo.png" },
  openGraph: {
    title: `${siteConfig.name} — Your Remote IT Partner`,
    description: siteConfig.description,
    url: `https://${siteConfig.domain}`,
    siteName: siteConfig.name,
    locale: "en_IN",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: siteConfig.tagline }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — Your Remote IT Partner`,
    description: siteConfig.description,
    images: ["/og-image.png"],
  },
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION && {
    verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION },
  }),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: `https://${siteConfig.domain}`,
    logo: `https://${siteConfig.domain}/logo.png`,
    sameAs: [siteConfig.social.instagram, siteConfig.social.twitter, siteConfig.social.linkedin],
  };

  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;

  return (
    <html lang="en" className={`${redHatDisplay.variable} ${redHatText.variable} ${redHatMono.variable}`}>
      <body className="antialiased">
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Analytics />
        <Nav />
        <PromiseBanner />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
