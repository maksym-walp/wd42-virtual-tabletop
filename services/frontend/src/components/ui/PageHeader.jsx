export default function PageHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div>
        <h1 className="font-display text-2xl text-accent sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-text-dim">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
