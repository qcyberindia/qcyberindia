export default function ServiceCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-6 hover:border-[var(--color-red)]/40 hover:shadow-md transition-all">
      <h3 className="font-display font-semibold text-[var(--color-navy)]">{name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-fog)]">{description}</p>
    </div>
  );
}
