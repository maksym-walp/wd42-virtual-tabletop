import { Link } from 'react-router-dom';
import { ENTITY_TYPES as ENTITY_TYPES_LIGHT, ENTITY_TYPES_DARK } from '../../constants/compendium';
import { useTheme } from '../../context/ThemeContext';

export default function CompendiumEntryCard({ entry }) {
  const { theme } = useTheme();
  const ENTITY_TYPES = theme === 'dark' ? ENTITY_TYPES_DARK : ENTITY_TYPES_LIGHT;
  const type = ENTITY_TYPES[entry.entity_type] || ENTITY_TYPES.npc;

  return (
    <Link
      to={`/compendium/entries/${entry.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: `4px solid ${type.color}` }}
    >
      {entry.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <img src={entry.image_url} alt={entry.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      <div
        className="flex items-center gap-2 border-b px-3.5 py-2"
        style={{ background: type.bg, borderBottomColor: type.color + '44' }}
      >
        <span
          className="rounded border px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide"
          style={{ color: type.color, borderColor: type.color + '66' }}
        >
          {type.label}
        </span>
        {entry.is_public && <span className="ml-auto text-[0.65rem] italic text-text-dim">публічний</span>}
        {!entry.is_owner && (
          <span className={`text-[0.65rem] italic text-text-dim ${entry.is_public ? '' : 'ml-auto'}`}>чужий</span>
        )}
      </div>

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{entry.name}</h3>

      {entry.description && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{entry.description}</p>
      )}
    </Link>
  );
}
