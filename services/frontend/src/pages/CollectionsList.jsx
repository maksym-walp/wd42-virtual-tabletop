import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, ArrowLeft } from 'lucide-react';
import { COLLECTION_DOMAINS } from '../collectionsDomains';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ScopeFilter from '../components/ScopeFilter';
import CanonBadge from '../components/CanonBadge';

export default function CollectionsList({ domainKey }) {
  const domain = COLLECTION_DOMAINS[domainKey];
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('');

  useEffect(() => {
    setLoading(true);
    domain.collectionsApi.getAll({ search, scope })
      .then(setCollections)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, scope, domainKey]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to={domain.basePath} className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> {domain.title}
      </Link>

      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-accent sm:text-3xl">Колекції — {domain.title}</h1>
          <p className="mt-0.5 text-sm text-text-dim">{collections.length} колекцій</p>
        </div>
        <Button to={`${domain.basePath}/collections/new`} className="hidden md:inline-flex">+ Нова колекція</Button>
      </div>

      <ScopeFilter scope={scope} onChange={setScope} className="mb-4" />

      <div className="relative mb-5">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
        <input
          className={`${inputClass} pl-10`}
          placeholder="Пошук за назвою..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : collections.length === 0 ? (
        <EmptyState title="Колекцій не знайдено" action={<Button to={`${domain.basePath}/collections/new`}>Створити першу</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Link
              key={c.id}
              to={`${domain.basePath}/collections/${c.id}`}
              className="block overflow-hidden rounded-lg border border-border bg-surface"
              style={{ borderLeft: '4px solid var(--color-accent)' }}
            >
              <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2">
                <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-text-dim">
                  {(c.items || []).length} {domain.itemLabel}
                </span>
                {c.is_canonical && <CanonBadge className="ml-auto" />}
                {c.is_public && <span className={`text-[0.65rem] italic text-text-dim ${c.is_canonical ? '' : 'ml-auto'}`}>публічна</span>}
                {!c.is_owner && <span className={`text-[0.65rem] italic text-text-dim ${c.is_canonical || c.is_public ? '' : 'ml-auto'}`}>чужа</span>}
              </div>
              <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{c.name}</h3>
              {c.description && (
                <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{c.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      <Link
        to={`${domain.basePath}/collections/new`}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label="Нова колекція"
      >
        <Plus size={26} />
      </Link>
    </div>
  );
}
