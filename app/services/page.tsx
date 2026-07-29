import type { Metadata } from "next";
import CategorySection from "@/components/CategorySection";
import PricingTable from "@/components/PricingTable";
import { serviceCategories } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Managed IT, infrastructure, security, business applications, and growth — the outsourced IT department for startups, MSMEs, and educational institutions in India.",
};

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <p className="eyebrow mb-4">SERVICES</p>
      <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--color-navy)] max-w-2xl">
        The capabilities behind each solution
      </h1>
      <p className="mt-4 max-w-xl text-[var(--color-fog)]">
        You don&apos;t need to know what&apos;s running behind the scenes — that&apos;s the point of working with
        one accountable partner. But if you want the detail, here&apos;s exactly what we manage.
      </p>

      <div className="mt-4">
        {serviceCategories.map((cat, i) => (
          <CategorySection key={cat.id} category={cat} index={i} />
        ))}
      </div>

      <PricingTable />
    </div>
  );
}
