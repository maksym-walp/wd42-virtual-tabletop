import { Link } from 'react-router-dom';
import { ARCHETYPES, ARCHETYPE_COLORS as ARCHETYPE_COLORS_LIGHT, ARCHETYPE_COLORS_DARK } from '../constants/characterSheet';
import { useTheme } from '../context/ThemeContext';
import AuthorBadge from './AuthorBadge';

export default function AbilityCard({ ability }) {
  const { theme } = useTheme();
  const ARCHETYPE_COLORS = theme === 'dark' ? ARCHETYPE_COLORS_DARK : ARCHETYPE_COLORS_LIGHT;
  return (
    <Link
      to={`/abilities/${ability.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: '4px solid var(--color-gold)' }}
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
      </div>

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{ability.name}</h3>
      <AuthorBadge username={ability.owner_username} variant="inline" className="px-3.5 pb-1" />

      {!ability.image_url && ability.description && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{ability.description}</p>
      )}
    </Link>
  );
}
