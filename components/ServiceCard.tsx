export default function ServiceCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="card p-6">
      <h3 className="font-display font-bold text-[var(--color-navy)]">{name}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-fog)]">{description}</p>
    </div>
  );
}
