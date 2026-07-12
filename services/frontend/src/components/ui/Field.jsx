// Shared className for the raw <input>/<select>/<textarea> inside a Field —
// exported separately since not every input is wrapped in a label (e.g.
// inline filter controls), but should still look consistent.
export const inputClass =
  'w-full min-h-11 rounded-lg border border-border bg-bg px-3.5 py-2.5 text-text ' +
  'placeholder:text-text-dim focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

export default function Field({ label, hint, className = '', children }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">
          {label}
        </span>
      )}
      {children}
      {hint && <span className="text-xs text-text-dim">{hint}</span>}
    </label>
  );
}
