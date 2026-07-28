import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="font-mono text-sm text-[var(--color-red)] mb-4">404</p>
      <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--color-navy)]">
        This page went down. We&apos;d have caught that.
      </h1>
      <p className="mt-4 text-[var(--color-fog)]">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center rounded-md bg-[var(--color-red)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-red-deep)] transition-colors"
      >
        Back to homepage
      </Link>
    </div>
  );
}
