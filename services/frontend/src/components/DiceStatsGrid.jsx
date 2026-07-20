export default function DiceStatsGrid({ diceStats }) {
  if (!diceStats || diceStats.total_rolls <= 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Всього кидків" value={diceStats.total_rolls} />
      <StatTile label="Всього кубиків" value={diceStats.total_dice_rolled} />
      <StatTile label="Натуральні 20" value={diceStats.nat20_count} />
      <StatTile label="Натуральні 1" value={diceStats.nat1_count} />
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-bg px-2 py-3">
      <span className="font-display text-xl text-accent">{value}</span>
      <span className="text-center text-[0.65rem] uppercase tracking-wide text-text-dim">{label}</span>
    </div>
  );
}
