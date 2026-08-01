import { Link } from 'react-router-dom';
import { NATURE_TYPES, RITUAL_TYPES, SPELL_KINDS, formatDuration } from '../constants/spellbook';
import DiceFormulaText from './DiceFormulaText';
import AuthorBadge from './AuthorBadge';

export default function SpellCard({ spell }) {
  const ritual = RITUAL_TYPES[spell.ritual];
  const kind = SPELL_KINDS[spell.spell_kind];

  return (
    <Link
      to={`/spellbook/${spell.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: '4px solid var(--color-accent)' }}
    >
      {spell.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <img src={spell.image_url} alt={spell.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-hover px-3.5 py-2">
        {(spell.nature || []).map((key) => {
          const n = NATURE_TYPES[key];
          if (!n) return null;
          return (
            <span
              key={key}
              className="rounded border border-border px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-text-dim"
            >
              {n.label}
            </span>
          );
        })}
        {kind && <span className="rounded border border-border px-1.5 py-0.5 text-[0.68rem] font-semibold text-text-dim">{kind.label}</span>}
      </div>

      {/* Title */}
      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{spell.name}</h3>
      <AuthorBadge username={spell.owner_username} variant="inline" className="px-3.5 pb-1" />

      {/* Stats row */}
      <div className="my-2 grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-4">
        <StatBox label="Енергія" value={spell.energy_cost} />
        <StatBox label="Дії" value={`${spell.action_time}/3`} />
        <StatBox label="Ритуал" value={`${ritual.symbol} ${ritual.label}`} />
        <StatBox label="Тривалість" value={formatDuration(spell.duration_value, spell.duration_unit)} />
      </div>

      {/* Narrative preview */}
      {!spell.image_url && spell.narrative_desc && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">
          <DiceFormulaText text={spell.narrative_desc} />
        </p>
      )}
    </Link>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-surface px-1.5 py-2">
      <span className="text-[0.62rem] uppercase tracking-wide text-text-dim">{label}</span>
      <span className="text-sm font-semibold text-text">{value}</span>
    </div>
  );
}
