export default function EmptyState({ icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 px-6 text-center">
      {icon && <div className="text-4xl">{icon}</div>}
      {title && <p className="font-display text-lg text-text-muted">{title}</p>}
      {children && <p className="text-sm text-text-dim">{children}</p>}
      {action}
    </div>
  );
}
