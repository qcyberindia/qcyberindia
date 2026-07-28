import type { Metadata } from "next";
import ContactForm from "@/components/ContactForm";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with QCyberIndia about managed infrastructure, security, or hosting.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="font-mono text-sm text-[var(--color-red)] mb-4">CONTACT</p>
      <h1 className="font-display text-3xl md:text-4xl font-bold text-[var(--color-navy)]">
        Tell us what you&apos;re running, and where it&apos;s slowing you down
      </h1>
      <p className="mt-4 text-[var(--color-fog)]">
        Or email us directly at{" "}
        <a href={`mailto:${siteConfig.email.info}`} className="text-[var(--color-red)] hover:underline">
          {siteConfig.email.info}
        </a>
        .
      </p>

      <div className="mt-10">
        <ContactForm />
      </div>
    </div>
  );
}
