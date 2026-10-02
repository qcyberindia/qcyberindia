import { DateDisplay } from "@/components/fund/display";
import { humanize } from "@/components/fund/format";
import type { AuditDto } from "@/components/fund/api";

function actorOf(e: AuditDto): string {
  return e.actor_name ?? (e.user_id !== null ? `User #${e.user_id}` : "System");
}

function describe(e: AuditDto): string {
  const what = humanize(e.entity_type);
  return `${humanize(e.action)}${e.entity_id !== null ? ` \u00B7 ${what} #${e.entity_id}` : ` \u00B7 ${what}`}`;
}

/** Compact "what just happened" list for the dashboard. */
export function ActivityTimeline({ items }: { items: ReadonlyArray<AuditDto> }) {
  return (
    <ol className="divide-y divide-[var(--qf-line)]">
      {items.map((e) => (
        <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[14px] font-medium text-[var(--qf-ink)]">{describe(e)}</p>
            <p className="text-[12.5px] text-[var(--qf-ink-soft)]">by {actorOf(e)}</p>
          </div>
          <DateDisplay value={e.created_at} className="text-[12.5px] text-[var(--qf-ink-soft)]" />
        </li>
      ))}
    </ol>
  );
}

function StateBlock({ title, state }: { title: string; state: Record<string, unknown> | null }) {
  if (!state) return null;
  const entries = Object.entries(state);
  if (entries.length === 0) return null;
  return (
    <div className="min-w-0">
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--qf-ink-soft)]">{title}</h4>
      <dl className="mt-1.5 space-y-1 text-[13px]">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="shrink-0 text-[var(--qf-ink-soft)]">{humanize(k)}:</dt>
            <dd className="min-w-0 break-words text-[var(--qf-ink)]">{v === null || v === undefined ? "\u2014" : String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Read-only audit trail. Each entry shows the actor, action, entity and
 * reason up front; the before/after state and field-level changes sit in a
 * native <details> so keyboard and screen-reader users can expand them.
 */
export function AuditTimeline({ items }: { items: ReadonlyArray<AuditDto> }) {
  return (
    <ol className="divide-y divide-[var(--qf-line)]">
      {items.map((e) => {
        const reason = e.diff?.reason ?? null;
        const changes = e.diff?.changes ? Object.entries(e.diff.changes) : [];
        const hasDetail = Boolean(e.before_state || e.after_state || changes.length > 0);
        return (
          <li key={e.id} className="px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <p className="text-[14.5px] font-semibold text-[var(--qf-ink)]">{humanize(e.action)}</p>
              <DateDisplay value={e.created_at} className="text-[12.5px] text-[var(--qf-ink-soft)]" />
            </div>
            <dl className="mt-1.5 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-3">
              <div>
                <dt className="inline text-[var(--qf-ink-soft)]">Actor: </dt>
                <dd className="inline text-[var(--qf-ink)]">{actorOf(e)}</dd>
              </div>
              <div>
                <dt className="inline text-[var(--qf-ink-soft)]">Entity: </dt>
                <dd className="inline text-[var(--qf-ink)]">{humanize(e.entity_type)}</dd>
              </div>
              <div>
                <dt className="inline text-[var(--qf-ink-soft)]">Entity ID: </dt>
                <dd className="inline text-[var(--qf-ink)]">{e.entity_id ?? "\u2014"}</dd>
              </div>
            </dl>
            {reason && (
              <p className="mt-2 rounded-md bg-[var(--qf-cream-1)] px-3 py-2 text-[13px] text-[var(--qf-ink)]">
                <span className="font-semibold">Reason: </span>
                {typeof reason === "string" ? reason : JSON.stringify(reason)}
              </p>
            )}
            {hasDetail && (
              <details className="mt-2 text-[13px]">
                <summary className="cursor-pointer text-[var(--qf-brass-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--qf-brass)]">
                  View state and changes
                </summary>
                {changes.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {changes.map(([field, c]) => (
                      <li key={field} className="text-[var(--qf-ink)]">
                        <span className="text-[var(--qf-ink-soft)]">{humanize(field)}: </span>
                        {String(c.from ?? "\u2014")} <span aria-label="changed to">&rarr;</span> {String(c.to ?? "\u2014")}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <StateBlock title="Before" state={e.before_state ?? null} />
                  <StateBlock title="After" state={e.after_state ?? null} />
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
}
