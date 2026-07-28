import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Note: Strict-Transport-Security is intentionally set at the Nginx/Cloudflare
  // layer instead of here, since HSTS should only be sent once HTTPS is
  // confirmed working end-to-end for the live domain — see SETUP.md.
];

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false, // don't advertise "X-Powered-By: Next.js"
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
