import { Link } from 'react-router-dom';
import AuthorBadge from './AuthorBadge';
import { StatGrid, StatBox } from './StatGrid';

export default function ManeuverCard({ maneuver }) {
  return (
    <Link
      to={`/abilities/maneuvers/${maneuver.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: '4px solid var(--color-gold)' }}
    >
      {maneuver.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <img src={maneuver.image_url} alt={maneuver.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      {/* Same stat-cell treatment as the spell/equipment cards' rows, in
          place of the old loose badge — a maneuver only ever has one stat
          (its action cost), so this is a single full-width cell. */}
      <StatGrid className="grid-cols-1">
        <StatBox label="Дії" value={`${maneuver.duration_actions}/3`} />
      </StatGrid>

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{maneuver.name}</h3>
      <AuthorBadge username={maneuver.owner_username} variant="inline" className="px-3.5 pb-1" />

      {!maneuver.image_url && maneuver.description && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{maneuver.description}</p>
      )}
    </Link>
  );
}
