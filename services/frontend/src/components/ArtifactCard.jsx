import { Link } from 'react-router-dom';
import { ARTIFACT_TYPE, RARITIES } from '../constants/artifacts';
import CanonBadge from './CanonBadge';
import AuthorBadge from './AuthorBadge';

export default function ArtifactCard({ artifact }) {
  const rarity = RARITIES[artifact.rarity];

  return (
    <Link
      to={`/artifacts/${artifact.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: `4px solid ${ARTIFACT_TYPE.color}` }}
    >
      {artifact.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <img src={artifact.image_url} alt={artifact.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      <div
        className="flex items-center gap-2 border-b px-3.5 py-2"
        style={{ background: ARTIFACT_TYPE.bg, borderBottomColor: ARTIFACT_TYPE.color + '44' }}
      >
        {rarity && (
          <span className="rounded border px-1.5 py-0.5 text-[0.68rem] font-semibold" style={{ color: rarity.color, borderColor: rarity.color + '66' }}>
            {rarity.label}
          </span>
        )}
        {artifact.is_canonical && <CanonBadge className="ml-auto" />}
        {artifact.is_public && <span className={`text-[0.65rem] italic text-text-dim ${artifact.is_canonical ? '' : 'ml-auto'}`}>публічне</span>}
        {!artifact.is_owner && <span className={`text-[0.65rem] italic text-text-dim ${artifact.is_canonical || artifact.is_public ? '' : 'ml-auto'}`}>чуже</span>}
      </div>

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{artifact.name}</h3>
      {artifact.creator && <p className="px-3.5 pb-1 text-xs italic text-text-dim">Творець: {artifact.creator}</p>}
      <AuthorBadge username={artifact.owner_username} variant="inline" className="px-3.5 pb-1" />

      {artifact.price != null && (
        <div className="my-2 grid grid-cols-1 gap-px border-y border-border bg-border">
          <div className="flex flex-col items-center gap-0.5 bg-surface px-1.5 py-2">
            <span className="text-[0.62rem] uppercase tracking-wide text-text-dim">Ціна</span>
            <span className="text-sm font-semibold text-text">{artifact.price}</span>
          </div>
        </div>
      )}

      {artifact.description && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{artifact.description}</p>
      )}
    </Link>
  );
}
