import { Link } from 'react-router-dom';
import CanonBadge from './CanonBadge';
import AuthorBadge from './AuthorBadge';

export default function ManeuverCard({ maneuver }) {
  return (
    <Link
      to={`/maneuvers/${maneuver.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: '4px solid #8a5a2b' }}
    >
      {maneuver.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <img src={maneuver.image_url} alt={maneuver.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2">
        <span className="rounded border border-border px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-text-dim">
          {maneuver.duration_actions} {maneuver.duration_actions === 1 ? 'дія' : 'дії'}
        </span>
        {maneuver.is_canonical && <CanonBadge className="ml-auto" />}
        {maneuver.is_public && <span className={`text-[0.65rem] italic text-text-dim ${maneuver.is_canonical ? '' : 'ml-auto'}`}>публічне</span>}
        {!maneuver.is_owner && <span className={`text-[0.65rem] italic text-text-dim ${maneuver.is_canonical || maneuver.is_public ? '' : 'ml-auto'}`}>чуже</span>}
      </div>

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{maneuver.name}</h3>
      <AuthorBadge username={maneuver.owner_username} variant="inline" className="px-3.5 pb-1" />

      {maneuver.description && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{maneuver.description}</p>
      )}
    </Link>
  );
}
