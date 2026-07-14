import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { COLLECTION_DOMAINS } from '../collectionsDomains';

// Grid columns follow the same breakpoints as the item grids below
// (grid-cols-1 sm:grid-cols-2 lg:grid-cols-3), so "first row" means index 0
// on mobile, indices 0-1 at sm, indices 0-2 at lg.
const COLUMNS = { base: 1, sm: 2, lg: 3 };

function itemVisibility(index) {
  return [
    index < COLUMNS.base ? 'block' : 'hidden',
    index < COLUMNS.sm ? 'sm:block' : 'sm:hidden',
    index < COLUMNS.lg ? 'lg:block' : 'lg:hidden',
  ].join(' ');
}

function toggleVisibility(count) {
  return [
    count > COLUMNS.base ? 'flex' : 'hidden',
    count > COLUMNS.sm ? 'sm:flex' : 'sm:hidden',
    count > COLUMNS.lg ? 'lg:flex' : 'lg:hidden',
  ].join(' ');
}

export default function CollectionsRow({ domainKey }) {
  const domain = COLLECTION_DOMAINS[domainKey];
  const [collections, setCollections] = useState([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    domain.collectionsApi.getAll({}).then(setCollections).catch(console.error);
  }, [domainKey]);

  if (collections.length === 0) return null;

  return (
    <div className="mb-5">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Колекції</h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((c, i) => (
          <Link
            key={c.id}
            to={`${domain.basePath}/collections/${c.id}`}
            className={`overflow-hidden rounded-lg border border-border bg-surface ${expanded ? '' : itemVisibility(i)}`}
            style={{ borderLeft: '4px solid var(--color-accent)' }}
          >
            <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2">
              <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-text-dim">
                {(c.items || []).length} {domain.itemLabel}
              </span>
              {c.is_public && <span className="ml-auto text-[0.65rem] italic text-text-dim">публічна</span>}
              {!c.is_owner && <span className="ml-auto text-[0.65rem] italic text-text-dim">чужа</span>}
            </div>
            <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{c.name}</h3>
            {c.description && (
              <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{c.description}</p>
            )}
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={`mx-auto mt-2 items-center gap-1 text-sm font-semibold text-text-dim hover:text-accent ${toggleVisibility(collections.length)}`}
      >
        {expanded ? 'Згорнути' : 'Переглянути усі колекції'}
        <ChevronDown size={16} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
    </div>
  );
}
