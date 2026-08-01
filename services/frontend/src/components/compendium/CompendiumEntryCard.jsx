import { Link } from 'react-router-dom';
import { ENTITY_TYPES } from '../../constants/compendium';

export default function CompendiumEntryCard({ entry }) {
  const type = ENTITY_TYPES[entry.entity_type] || ENTITY_TYPES.npc;

  return (
    <Link
      to={`/compendium/entries/${entry.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: '4px solid var(--color-accent)' }}
    >
      {entry.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <img src={entry.image_url} alt={entry.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-border bg-surface-hover px-3.5 py-2">
        <span className="rounded border border-border px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-text-dim">
          {type.label}
        </span>
      </div>

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{entry.name}</h3>

      {!entry.image_url && entry.description && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{entry.description}</p>
      )}
    </Link>
  );
}
