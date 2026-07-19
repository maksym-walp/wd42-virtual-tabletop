import { Link } from 'react-router-dom';
import { ARCHETYPES, ARCHETYPE_COLORS } from '../constants/characterSheet';
import CanonBadge from './CanonBadge';

export default function AbilityCard({ ability }) {
  return (
    <Link
      to={`/abilities/${ability.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: '4px solid #8a5a2b' }}
    >
      {ability.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <img src={ability.image_url} alt={ability.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3.5 py-2">
        {(ability.archetypes ?? []).map((a) => (
          <span
            key={a}
            className="rounded border px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide"
            style={{ borderColor: ARCHETYPE_COLORS[a]?.color, color: ARCHETYPE_COLORS[a]?.color }}
          >
            {ARCHETYPES[a]?.label ?? a}
          </span>
        ))}
        {ability.is_canonical && <CanonBadge className="ml-auto" />}
        {ability.is_public && <span className={`text-[0.65rem] italic text-text-dim ${ability.is_canonical ? '' : 'ml-auto'}`}>публічне</span>}
        {!ability.is_owner && <span className={`text-[0.65rem] italic text-text-dim ${ability.is_canonical || ability.is_public ? '' : 'ml-auto'}`}>чуже</span>}
      </div>

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{ability.name}</h3>

      {ability.description && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{ability.description}</p>
      )}
    </Link>
  );
}
