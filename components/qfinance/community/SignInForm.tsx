"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";

/**
 * Shown wherever Community needs identity (asking, replying, reporting).
 * QFinera now uses one account with a password; this prompt sends people to
 * sign in or register and brings them back to the same page afterwards.
 */
export default function SignInForm({ prompt = "Sign in to continue" }: { prompt?: string }) {
  const pathname = usePathname() ?? "/qfinera/community";
  const next = encodeURIComponent(pathname);
  return (
    <div className="rounded-lg border border-[var(--qf-line)] bg-[var(--qf-cream-1)] p-5 text-center">
      <p className="font-display text-[17px] font-semibold text-[var(--qf-ink)]">{prompt}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13.5px] text-[var(--qf-ink-soft)]">
        Your display name appears on what you post. Your email stays private.
      </p>
      <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
        <Link
          href={`/qfinera/login?next=${next}`}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--qf-brass-dark)] px-4 py-2 font-display text-[14.5px] font-semibold text-[var(--qf-cream-0)] hover:opacity-90"
        >
          <LogIn size={15} aria-hidden="true" /> Sign in
        </Link>
        <Link
          href="/qfinera/register"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--qf-line)] px-4 py-2 text-[14.5px] font-semibold text-[var(--qf-ink)] hover:border-[var(--qf-brass)]"
        >
          Create an account
        </Link>
      </div>
    </div>
  );
}
