# QCyberIndia — Setup Notes

## Run locally
```
npm install
cp .env.local.example .env.local
npm run dev
```

## Fonts
This build uses system font fallbacks because the build sandbox couldn't reach
fonts.googleapis.com. On your dev machine or deploy target, switch back to
next/font/google for the real Space Grotesk / Inter / JetBrains Mono webfonts:

In `app/layout.tsx`, restore:
```ts
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500","700"] });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", weight: ["400","500"] });
```
and add `className={`${display.variable} ${body.variable} ${mono.variable}`}` back to the `<html>` tag.
No other file needs to change — `app/globals.css` already reads from these CSS variables.

## Contact form (phase 2)
`lib/email.ts` is provider-agnostic. To go live:
1. Pick Resend or SES.
2. Set `EMAIL_PROVIDER=resend` (or `ses`) in your env.
3. Uncomment the relevant block in `lib/email.ts` and install the SDK
   (`npm install resend` or `npm install @aws-sdk/client-sesv2`).

Until `EMAIL_PROVIDER` is set, submissions are just logged to the server console —
useful for testing the form end-to-end without a provider yet.

## Analytics & SEO (phase 4)
Set in `.env.local`:
```
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
NEXT_PUBLIC_CLARITY_ID=your-clarity-id
```
`sitemap.xml` and `robots.txt` are auto-generated (`app/sitemap.ts`, `app/robots.ts`) —
nothing to configure, they pick up domain + blog posts automatically.

## Blog
Add a new post: drop a `.md` file into `content/blog/` with frontmatter:
```md
---
title: "Your title"
date: "2026-08-01"
excerpt: "One-line summary for the index page"
---

Post content in markdown.
```
No CMS, no database — it's picked up automatically at build time.

## Deploy (per SOP-WEB-001)
```
npm run build
npm run start   # or serve via PM2 behind Nginx per your SOP
```
