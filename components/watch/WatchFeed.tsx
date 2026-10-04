"use client";

// Global Watch feed: search, category filters, sort, "mine", pagination.
// Filters live in the URL so a filtered view can be shared and survives reload.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, Search, ShieldCheck } from "lucide-react";
import { ApiError, apiFetch, errorMessage, type WatchItemDto } from "@/components/fund/api";
import { EmptyState, ErrorState, LoadingSkeleton, btnPrimary, btnSecondary } from "@/components/fund/parts";
import { CATEGORIES, CATEGORY_LABEL, WatchCard } from "@/components/watch/shared";

type Feed = { items: WatchItemDto[]; total: number; page: number; pageSize: number; viewer: { userId: number; platformRole: string } };

const chip = (active: boolean) =>
  `inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)] ${
    active ? "border-[var(--qf-brass)] bg-[var(--qf-brass)]/12 text-[var(--qf-ink)]" : "border-[var(--qf-line)] text-[var(--qf-ink-soft)] hover:border-[var(--qf-brass)]/60 hover:text-[var(--qf-ink)]"
  }`;

export function WatchFeed() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const category = sp.get("category") ?? "";
  const sort = sp.get("sort") === "updated" ? "updated" : "latest";
  const mine = sp.get("mine") === "1";
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const [search, setSearch] = useState(q);
  const [result, setResult] = useState<{ key: string; data: Feed | null; error: ApiError | null } | null>(null);
  const [version, setVersion] = useState(0);
  const key = `${q}|${category}|${sort}|${mine}|${page}|${version}`;

  useEffect(() => {
    const controller = new AbortController();
    apiFetch<Feed>("/api/qfinera/watch", { query: { q, category, sort, mine: mine ? 1 : null, page }, signal: controller.signal })
      .then((data) => setResult({ key, data, error: null }))
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setResult({ key, data: null, error: err instanceof ApiError ? err : new ApiError("ERROR", errorMessage(err), 0) });
      });
    return () => controller.abort();
  }, [key, q, category, sort, mine, page]);

  function update(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    if (!("page" in next)) params.delete("page");
    router.replace(`${pathname}${params.toString() ? `?${params}` : ""}`, { scroll: false });
  }

  const current = result?.key === key ? result : null;
  const feed = current?.data;
  const pages = feed ? Math.max(1, Math.ceil(feed.total / feed.pageSize)) : 1;
  const moderator = feed && feed.viewer.platformRole !== "USER";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          role="search"
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: search.trim() || null });
          }}
        >
          <label htmlFor="watch-search" className="sr-only">
            Search Global Watch
          </label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--qf-ink-soft)]" aria-hidden="true" />
          <input
            id="watch-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, symbol, industry or tag"
            maxLength={100}
            className="min-h-11 w-full rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] pl-9 pr-3 text-[14.5px] text-[var(--qf-ink)] placeholder:text-[var(--qf-ink-soft)]/80 focus:border-[var(--qf-brass)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qf-brass)]/40"
          />
        </form>
        <div className="flex gap-2">
          <label htmlFor="watch-sort" className="sr-only">
            Sort
          </label>
          <select
            id="watch-sort"
            value={sort}
            onChange={(e) => update({ sort: e.target.value === "updated" ? "updated" : null })}
            className="min-h-11 rounded-md border border-[var(--qf-line)] bg-[var(--qf-cream-0)] px-3 text-[14px] text-[var(--qf-ink)] focus:border-[var(--qf-brass)] focus:outline-none"
          >
            <option value="latest">Latest</option>
            <option value="updated">Recently updated</option>
          </select>
          <Link href="/qfinera/watch/new" className={`${btnPrimary} min-h-11 whitespace-nowrap`}>
            <Plus size={16} aria-hidden="true" /> Share
          </Link>
        </div>
      </div>

      <nav aria-label="Filter by category" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-2 sm:flex-wrap">
          <li>
            <button type="button" className={chip(!category && !mine)} aria-pressed={!category && !mine} onClick={() => update({ category: null, mine: null })}>
              All
            </button>
          </li>
          {CATEGORIES.map((c) => (
            <li key={c}>
              <button type="button" className={chip(category === c)} aria-pressed={category === c} onClick={() => update({ category: category === c ? null : c })}>
                {CATEGORY_LABEL[c]}
              </button>
            </li>
          ))}
          <li>
            <button type="button" className={chip(mine)} aria-pressed={mine} onClick={() => update({ mine: mine ? null : "1" })}>
              My posts
            </button>
          </li>
        </ul>
      </nav>

      {moderator && (
        <Link href="/qfinera/watch/requests" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--qf-brass-dark)] hover:underline">
          <ShieldCheck size={14} aria-hidden="true" /> Moderation requests
        </Link>
      )}

      {!current ? (
        <div className="rounded-xl border border-[var(--qf-line)]">
          <LoadingSkeleton label="Loading Global Watch" />
        </div>
      ) : current.error ? (
        <div className="rounded-xl border border-[var(--qf-line)]">
          <ErrorState error={current.error} onRetry={() => setVersion((v) => v + 1)} />
        </div>
      ) : feed && feed.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--qf-line)]">
          <EmptyState
            title={q || category || mine ? "Nothing matches" : "Nothing shared yet"}
            description={
              q || category || mine
                ? "Try a different search or category."
                : "Found something others should know about? A company announcement, a useful article, a risk? Share it."
            }
            action={
              q || category || mine ? (
                <button type="button" className={btnSecondary} onClick={() => update({ q: null, category: null, mine: null })}>
                  Clear filters
                </button>
              ) : (
                <Link href="/qfinera/watch/new" className={btnPrimary}>
                  Share the first item
                </Link>
              )
            }
          />
        </div>
      ) : feed ? (
        <>
          <p className="text-[13px] text-[var(--qf-ink-soft)]" aria-live="polite">
            {feed.total} item{feed.total === 1 ? "" : "s"}
            {q ? ` for “${q}”` : ""}
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {feed.items.map((item) => (
              <WatchCard key={item.id} item={item} />
            ))}
          </ul>
          {pages > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between gap-3 pt-2">
              <button type="button" className={btnSecondary} disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                Previous
              </button>
              <span className="text-[13px] text-[var(--qf-ink-soft)]">
                Page {page} of {pages}
              </span>
              <button type="button" className={btnSecondary} disabled={page >= pages} onClick={() => update({ page: String(page + 1) })}>
                Next
              </button>
            </nav>
          )}
        </>
      ) : null}
    </div>
  );
}
