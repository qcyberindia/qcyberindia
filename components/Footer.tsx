import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/lib/site-config";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-line)] mt-24 bg-[var(--color-navy)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="QCyberIndia" width={36} height={36} className="h-9 w-9 object-contain" />
            <span className="font-display font-bold text-lg">
              QCyber<span className="text-[var(--color-gold)]">India</span>
            </span>
          </div>
          <p className="mt-3 text-sm text-white/70 max-w-xs">{siteConfig.subTagline}</p>
        </div>

        <div className="text-sm text-white/70">
          <div className="text-white mb-3 font-medium">Reach us</div>
          <ul className="space-y-2">
            <li><a href={`mailto:${siteConfig.email.info}`} className="hover:text-white">{siteConfig.email.info}</a></li>
            <li><a href={`mailto:${siteConfig.email.support}`} className="hover:text-white">{siteConfig.email.support}</a></li>
            <li><a href={`mailto:${siteConfig.email.careers}`} className="hover:text-white">{siteConfig.email.careers}</a></li>
            <li><a href={`mailto:${siteConfig.email.security}`} className="hover:text-white">{siteConfig.email.security}</a></li>
          </ul>
        </div>

        <div className="text-sm text-white/70">
          <div className="text-white mb-3 font-medium">Explore</div>
          <ul className="space-y-2">
            <li><Link href="/solutions" className="hover:text-white">Solutions</Link></li>
            <li><Link href="/services" className="hover:text-white">Services</Link></li>
            <li><Link href="/industries" className="hover:text-white">Industries</Link></li>
            <li><Link href="/why-qcyberindia" className="hover:text-white">Why QCyberIndia</Link></li>
            <li><Link href="/resources" className="hover:text-white">Resources</Link></li>
          </ul>
        </div>

        <div className="text-sm text-white/70">
          <div className="text-white mb-3 font-medium">Company</div>
          <ul className="space-y-2">
            <li><Link href="/about" className="hover:text-white">About</Link></li>
            <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-6 text-center text-xs text-white/60">
        © {new Date().getFullYear()} {siteConfig.name}. Your remote IT department, based in {siteConfig.city}.
      </div>
    </footer>
  );
}
