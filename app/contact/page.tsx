import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import PageHeader from "@/components/PageHeader";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with QCyberIndia about managed infrastructure, security, or hosting.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <PageHeader
        eyebrow="Contact"
        title="Tell us what you're running, and where it's slowing you down"
        description={
          <>
            Or email us directly at{" "}
            <a href={`mailto:${siteConfig.email.info}`} className="text-[var(--color-red)] hover:underline">
              {siteConfig.email.info}
            </a>
            .
          </>
        }
        maxWidth="max-w-none"
      />

      <div className="mt-10">
        <ContactForm />
      </div>
    </div>
  );
}
