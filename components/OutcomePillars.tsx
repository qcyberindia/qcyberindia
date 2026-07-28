import { outcomePillars } from "@/lib/site-config";

export default function OutcomePillars() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {outcomePillars.map((p) => (
        <div key={p.id} className="rounded-xl border border-[var(--color-line)] bg-white p-7">
          <h3 className="font-display text-xl font-bold text-[var(--color-navy)]">{p.title}</h3>
          <p className="mt-1.5 text-sm text-[var(--color-fog)]">{p.promise}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {p.includes.map((item) => (
              <li
                key={item}
                className="text-xs font-medium text-[var(--color-navy)] bg-[var(--color-paper-2)] border border-[var(--color-line)] rounded-full px-3 py-1"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
