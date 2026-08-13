import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Careers",
  description: "Open roles at QCyberIndia.",
};

export default function CareersPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <PageHeader
        eyebrow="Careers"
        title="No open roles right now"
        description={
          <>
            We&apos;re a small, hands-on team today, but we&apos;re growing. If you work with network
            infrastructure, security operations, or cloud hosting and want to be first in line when a
            role opens, send your resume to{" "}
            <a href={`mailto:${siteConfig.email.careers}`} className="text-[var(--color-red)] hover:underline">
              {siteConfig.email.careers}
            </a>
            .
          </>
        }
      />
    </div>
  );
}
