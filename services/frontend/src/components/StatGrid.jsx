// Shared "stat cells" row used by every catalog card (spells, equipment,
// maneuvers, abilities) — a bordered grid of label/value boxes. Previously
// duplicated locally in SpellCard.jsx/EquipmentCard.jsx; pulled out once
// ManeuverCard/AbilityCard needed the same look for their own top panel.
export function StatGrid({ className = '', children }) {
  return (
    <div className={`my-2 grid gap-px border-y border-border bg-border ${className}`}>
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
