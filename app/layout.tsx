import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Analytics from "@/components/Analytics";
import { siteConfig } from "@/lib/site-config";

// NOTE: using next/font/google (Space Grotesk / Inter / JetBrains Mono) is the
// intended setup, but this build environment can't reach fonts.googleapis.com.
// Swap this back to next/font/google on your dev machine / deploy target —
// app/globals.css already defines the --font-display/--font-body/--font-mono
// variables, so no other file needs to change.

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
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — Your Remote IT Partner`,
    description: siteConfig.description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Analytics />
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
