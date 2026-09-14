import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Note: Strict-Transport-Security is intentionally set at the Nginx/Cloudflare
  // layer instead of here, since HSTS should only be sent once HTTPS is
  // confirmed working end-to-end for the live domain — see SETUP.md.
];

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false, // Don't advertise "X-Powered-By: Next.js"
  images: {
    // Screenshots in /public/qbids are large PNGs (250–530KB each).
    // Next's image optimizer re-encodes them to modern formats on request
    // instead of shipping raw PNG to every visitor.
    formats: ["image/avif", "image/webp"],
    qualities: [75, 82],
  },
  async redirects() {
    return [
      {
        source: "/qfinance",
        destination: "/qfinera",
        permanent: true,
      },
      {
        source: "/qfinance/about",
        destination: "/qfinera/about",
        permanent: true,
      },
      {
        source: "/qfinance/beta",
        destination: "/qfinera/beta",
        permanent: true,
      },
      {
        source: "/qfinance/community",
        destination: "/qfinera/community",
        permanent: true,
      },
      {
        source: "/qfinance/community/:id",
        destination: "/qfinera/community/:id",
        permanent: true,
      },
      {
        source: "/qfinance/learn",
        destination: "/qfinera/learn",
        permanent: true,
      },
      {
        source: "/qfinance/learn/beginner",
        destination: "/qfinera/learn/beginner",
        permanent: true,
      },
      {
        source: "/qfinance/learn/beginner/:path*",
        destination: "/qfinera/learn/beginner/:path*",
        permanent: true,
      },
      {
        source: "/qfinance/why-india-investing",
        destination: "/qfinera/why-india-investing",
        permanent: true,
      },
      {
        source: "/qfinance/beginner",
        destination: "/qfinera/beginner",
        permanent: true,
      },
    ];
  },
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
