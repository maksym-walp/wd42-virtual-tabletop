import { Link } from 'react-router-dom';
import { ARCHETYPES, ARCHETYPE_COLORS as ARCHETYPE_COLORS_LIGHT, ARCHETYPE_COLORS_DARK } from '../constants/characterSheet';
import { useTheme } from '../context/ThemeContext';
import AuthorBadge from './AuthorBadge';
import { StatGrid, StatBox } from './StatGrid';

// literal (not templated) column-count classes — Tailwind's content scan
// needs the full class name present in source to keep it.
const COLS_CLASS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' };

export default function AbilityCard({ ability }) {
  const { theme } = useTheme();
  const ARCHETYPE_COLORS = theme === 'dark' ? ARCHETYPE_COLORS_DARK : ARCHETYPE_COLORS_LIGHT;
  const archetypes = ability.archetypes ?? [];

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

      {/* Same stat-cell treatment as the spell/equipment cards' rows, in
          place of the old loose colored badges — one cell per archetype so
          the per-archetype color-coding still reads at a glance. */}
      <StatGrid className={COLS_CLASS[archetypes.length] || COLS_CLASS[1]}>
        {archetypes.length > 0 ? (
          archetypes.map((a) => (
            <StatBox
              key={a}
              label="Архетип"
              value={<span style={{ color: ARCHETYPE_COLORS[a]?.color }}>{ARCHETYPES[a]?.label ?? a}</span>}
            />
          ))
        ) : (
          <StatBox label="Архетип" value="—" />
        )}
      </StatGrid>

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{ability.name}</h3>
      <AuthorBadge username={ability.owner_username} variant="inline" className="px-3.5 pb-1" />

      {!ability.image_url && ability.description && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{ability.description}</p>
      )}
    </Link>
  );
}
