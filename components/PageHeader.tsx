import { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  description,
  children,
  maxWidth = "max-w-2xl",
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div>
      <p className="eyebrow mb-4">{eyebrow}</p>
      <h1 className={`font-display text-3xl md:text-4xl font-extrabold text-[var(--color-navy)] ${maxWidth}`}>
        {title}
      </h1>
      {description && (
        <p className={`mt-4 text-[var(--color-fog)] leading-relaxed ${maxWidth}`}>{description}</p>
      )}
      {children}
    </div>
  );
}
