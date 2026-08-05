import ServiceCard from "@/components/ServiceCard";
import type { ServiceCategory } from "@/lib/site-config";

export default function CategorySection({ category, index }: { category: ServiceCategory; index: number }) {
  return (
    <section id={category.id} className="section-tight border-t border-[var(--color-line)] first:border-t-0 first:pt-0">
      <div className="flex items-baseline gap-4">
        <span className="font-display text-2xl font-bold text-[var(--color-gold)]">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <h2 className="font-display text-2xl font-extrabold text-[var(--color-navy)]">{category.title}</h2>
          <p className="mt-1 text-[var(--color-fog)]">{category.summary}</p>
        </div>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {category.services.map((s) => (
          <ServiceCard key={s.name} name={s.name} description={s.description} />
        ))}
      </div>
    </section>
  );
}
