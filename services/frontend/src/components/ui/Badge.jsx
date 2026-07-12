// Renders the {color, bg} pattern shared by MAGIC_TYPES/ARCHETYPE_COLORS —
// these are runtime-computed values, so they stay inline style rather than
// Tailwind classes (Tailwind can't see dynamically-built class strings).
export default function Badge({ color, bg, className = '', children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
      style={{ color, backgroundColor: bg }}
    >
      {children}
    </span>
  );
}
