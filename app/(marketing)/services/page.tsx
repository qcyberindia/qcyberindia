import type { Metadata } from "next";
import CategorySection from "@/components/CategorySection";
import PricingTable from "@/components/PricingTable";
import PageHeader from "@/components/PageHeader";
import { serviceCategories } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Managed IT, infrastructure, security, business applications, and growth — the outsourced IT department for startups, MSMEs, and educational institutions in India.",
};

export default function ServicesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <PageHeader
        eyebrow="Services"
        title="The capabilities behind each solution"
        description="You don't need to know what's running behind the scenes — that's the point of working with one accountable partner. But if you want the detail, here's exactly what we manage."
        maxWidth="max-w-2xl"
      />

      <div className="mt-4">
        {serviceCategories.map((cat, i) => (
          <CategorySection key={cat.id} category={cat} index={i} />
        ))}
      </div>

      <PricingTable />
    </div>
  );
}
