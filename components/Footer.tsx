import Link from "next/link";
import Image from "next/image";
import { siteConfig } from "@/lib/site-config";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.446-2.136 2.94v5.666H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.56V9h3.554v11.452z" />
    </svg>
  );
}

const socialLinks = [
  { name: "Instagram", href: siteConfig.social.instagram, icon: InstagramIcon },
  { name: "X (Twitter)", href: siteConfig.social.twitter, icon: XIcon },
  { name: "LinkedIn", href: siteConfig.social.linkedin, icon: LinkedinIcon },
];

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-line)] mt-24 bg-[var(--color-navy)] text-white">
      <div className="mx-auto max-w-6xl px-6 py-14 grid gap-10 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="QCyberIndia" width={36} height={36} className="h-9 w-9 object-contain" />
            <span className="font-display font-bold text-lg">
            <span className="text-[var(--color-red)]">Q</span>
            <span className="text-white">Cyber</span>
            <span className="text-[var(--color-gold)]">India</span>
            </span>
          </div>
          <p className="mt-3 text-sm text-white/70 max-w-xs">{siteConfig.subTagline}</p>

          <div className="mt-5 flex items-center gap-3">
            {socialLinks.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-all duration-200 hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] hover:-translate-y-0.5"
              >
                <s.icon />
              </a>
            ))}
          </div>
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
