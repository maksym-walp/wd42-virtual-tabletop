import { Link } from 'react-router-dom';
import { natureLabels, SPELL_KINDS } from '../constants/spellbook';
import DiceFormulaText from './DiceFormulaText';
import AuthorBadge from './AuthorBadge';
import { StatGrid, StatBox } from './StatGrid';

export default function SpellCard({ spell }) {
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

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{spell.name}</h3>
      <AuthorBadge username={spell.owner_username} variant="inline" className="px-3.5 pb-1" />

      {/* Stats row — nature/kind moved down here (from the removed header
          bar) alongside the action-economy numbers, matching the equipment
          card's single stats-row layout. */}
      <StatGrid className="grid-cols-2 sm:grid-cols-4">
        <StatBox label="Природа" value={natureLabels(spell.nature) || '—'} />
        <StatBox label="Вид" value={kind?.label || '—'} />
        <StatBox label="Енергія" value={spell.energy_cost} />
        <StatBox label="Дії" value={`${spell.action_time}/3`} />
      </StatGrid>

      {/* Narrative preview */}
      {!spell.image_url && spell.narrative_desc && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">
          <DiceFormulaText text={spell.narrative_desc} />
        </p>
      )}
    </Link>
  );
}
