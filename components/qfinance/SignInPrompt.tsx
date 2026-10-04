import Link from "next/link";

/** For signed-out visitors on member-only pages: what this is, then sign in / join. */
export default function SignInPrompt({ next, children }: { next: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--qf-line)] bg-[var(--qf-cream-1)]/50 px-6 py-10 text-center sm:px-10">
      <div className="mx-auto max-w-lg text-[15px] leading-relaxed text-[var(--qf-ink-soft)]">{children}</div>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Link
          href={`/qfinera/login?next=${encodeURIComponent(next)}`}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--qf-brass-dark)] px-5 font-display text-[15px] font-semibold text-[var(--qf-cream-0)] hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/qfinera/register"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-5 text-[15px] font-semibold text-[var(--qf-ink)] hover:border-[var(--qf-brass)]"
        >
          Join QFinera
        </Link>
      </div>
    </div>
  );
}
