import { siteConfig } from "@/lib/site-config";

export default function PromiseBanner() {
  return (
    <div className="bg-[var(--color-navy)] py-3">
      <p className="text-center text-sm md:text-base font-display font-semibold text-white tracking-wide">
        {siteConfig.promise}
      </p>
    </div>
  );
}
