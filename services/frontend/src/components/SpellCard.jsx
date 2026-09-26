import { Link } from 'react-router-dom';
import { natureLabels, SPELL_KINDS, SPELL_COMPLEXITIES } from '../constants/spellbook';
import { pluralizeUk } from '../utils/pluralize';
import { htmlToPreviewText } from '../utils/richText';
import AuthorBadge from './AuthorBadge';
import { StatGrid, StatBox } from './StatGrid';

export default function SpellCard({ spell }) {
  const kind = SPELL_KINDS[spell.spell_kind];
  const complexity = SPELL_COMPLEXITIES[spell.complexity];
  const levelCount = 1 + (spell.levels || []).length;

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
      {(complexity || levelCount > 1) && (
        <p className="px-3.5 pb-1 text-xs text-text-dim">
          {[
            complexity?.label,
            levelCount > 1 ? `${levelCount} ${pluralizeUk(levelCount, ['рівень', 'рівні', 'рівнів'])}` : null,
          ].filter(Boolean).join(' · ')}
        </p>
      )}

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
          {htmlToPreviewText(spell.narrative_desc)}
        </p>
      )}
    </Link>
  );
}
