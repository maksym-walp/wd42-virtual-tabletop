import DieFace from './DieFace';

const WRAPPED_TYPES = new Set(['adv', 'dis', 'wadv', 'wdis']);

function ModifierChip({ group }) {
  return (
    <span className="inline-flex h-11 items-center rounded-lg border border-border px-3 text-sm font-semibold text-text-dim">
      {group.sign > 0 ? '+' : '−'}
      {group.value}
    </span>
  );
}

function DiceGroup({ group }) {
  if (group.type === 'modifier') return <ModifierChip group={group} />;

  if (group.type === 'dice') {
    return (
      <>
        {group.rolls.map((value, i) => (
          <DieFace key={i} sides={group.sides} value={value} />
        ))}
      </>
    );
  }

  if (WRAPPED_TYPES.has(group.type)) {
    return (
      <>
        {group.dice.map((die, i) => (
          <div key={i} className="flex items-center gap-0.5">
            {die.rolls.map((value, j) => (
              <DieFace
                key={j}
                sides={group.sides}
                value={value}
                dimmed={value !== die.kept}
              />
            ))}
          </div>
        ))}
      </>
    );
  }

  return null;
}

export default function DiceResult({ roll }) {
  if (!roll) return null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {roll.groups.map((group, i) => (
          <DiceGroup key={i} group={group} />
        ))}
      </div>
      <div className="text-center font-display text-2xl text-accent">
        Разом: {roll.total}
      </div>
    </div>
  );
}
