// Shared "stat cells" row used by every catalog card (spells, equipment,
// abilities) — a bordered grid of label/value boxes. Previously
// duplicated locally in SpellCard.jsx/EquipmentCard.jsx; pulled out once
// AbilityCard needed the same look for their own top panel.
// `topMargin` defaults to true (existing behavior everywhere this is already
// used) — pass false when the grid is the very first thing in its card (no
// image above it), so it sits flush against the card's top edge instead of
// leaving a bare gap under the border before the first label appears.
export function StatGrid({ className = '', topMargin = true, children }) {
  return (
    <div className={`${topMargin ? 'mt-2' : ''} mb-2 grid gap-px border-y border-border bg-border ${className}`}>
      {children}
    </div>
  );
}

export function StatBox({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-surface px-1.5 py-2">
      <span className="text-[0.62rem] uppercase tracking-wide text-text-dim">{label}</span>
      <span className="text-sm font-semibold text-text">{value}</span>
    </div>
  );
}
