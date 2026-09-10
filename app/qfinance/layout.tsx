import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { qfinanceConfig } from "@/lib/qfinance-config";

// Independent QFinance typography system.
// Fraunces is used for editorial headings and statements.
// Inter is used for body text, UI, numbers, metadata, and labels.
// No monospace typography is used anywhere in QFinance.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--qf-font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--qf-font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${qfinanceConfig.name} — Understand First. Invest Second.`,
    template: `%s | ${qfinanceConfig.name}`,
  },
  description: qfinanceConfig.description,
  alternates: { canonical: qfinanceConfig.path },
  openGraph: {
    title: `${qfinanceConfig.name} — Understand First. Invest Second.`,
    description: qfinanceConfig.description,
    url: qfinanceConfig.path,
    siteName: qfinanceConfig.name,
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${qfinanceConfig.name} — Understand First. Invest Second.`,
    description: qfinanceConfig.description,
  },
};

// Apply the saved theme before the page paints to avoid a flash
// of the wrong light/dark theme.
const themeInitScript = `
(function () {
  try {
    var root = document.getElementById('qf-root');
    if (!root) return;

    var saved = localStorage.getItem('qf-theme');

    var theme =
      saved === 'light' || saved === 'dark'
        ? saved
        : (
            window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light'
          );

    root.setAttribute('data-qf-theme', theme);
  } catch (e) {}
})();
`;

export default function QFinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      id="qf-root"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} qf-root min-h-screen bg-[var(--qf-cream-0)] font-body text-[var(--qf-ink)] text-[15px] leading-relaxed antialiased transition-colors duration-300`}
    >
      <script
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: themeInitScript }}
      />

      <style>{`
        @keyframes qf-scroll-arrow {
          0%,
          100% {
            transform: translateY(-1px);
            opacity: 0.65;
          }

          50% {
            transform: translateY(3px);
            opacity: 1;
          }
        }

        .qf-font-display,
        .font-display {
          font-family:
            var(--qf-font-display),
            'Fraunces',
            Georgia,
            serif;
        }

        .qf-font-body,
        .font-body {
          font-family:
            var(--qf-font-body),
            'Inter',
            sans-serif;
        }

        /* -------------------------------------------------------------
           Light theme
           ------------------------------------------------------------- */
        .qf-root {
          --qf-cream-0: #FBF8F1;
          --qf-cream-1: #F3EDDD;
          --qf-cream-2: #E9DFC6;

          --qf-brass: #A8863E;
          --qf-brass-dark: #7C6329;

          --qf-ink: #2B2621;
          --qf-ink-soft: #5B5347;

          --qf-line: #D8CBA9;

          --qf-up: #4B6C4A;
          --qf-down: #9C4B3F;

          --qf-fix: #3E6B52;
          --qf-fix-bg: #E7F0EA;
        }

        /* -------------------------------------------------------------
           Dark theme
           Warm editorial dark mode rather than a trading-terminal
           inversion.
           ------------------------------------------------------------- */
        .qf-root[data-qf-theme="dark"] {
          --qf-cream-0: #171512;
          --qf-cream-1: #211E19;
          --qf-cream-2: #2A261F;

          --qf-brass: #C19A4B;
          --qf-brass-dark: #DDB86B;

          --qf-ink: #F3EDDD;
          --qf-ink-soft: #B9AF9D;

          --qf-line: #494237;

          --qf-up: #7FAE7C;
          --qf-down: #C97A6B;

          --qf-fix: #6FA98B;
          --qf-fix-bg: #23302A;
        }
      `}</style>

      {children}
    </div>
  );
}