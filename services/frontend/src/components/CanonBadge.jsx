// Small marker shown on admin-authored ("канонічне") catalog entries so users can
// tell official content apart from community content — including in mixed lists
// (the "Усі" filter, character-sheet pickers).
export default function CanonBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-gold/50 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-gold ${className}`}
      title="Канонічний запис (створений адміністратором)"
    >
      Канон
    </span>
  );
}
