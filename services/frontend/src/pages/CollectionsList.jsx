import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { COLLECTION_DOMAINS, getDomainTabs } from '../collectionsDomains';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ScopeFilter from '../components/ScopeFilter';
import CatalogTabs from '../components/CatalogTabs';
import FilterAccordion from '../components/ui/FilterAccordion';
import FilterToggleButton from '../components/ui/FilterToggleButton';
import EquipmentCollectionsByType from '../components/EquipmentCollectionsByType';
import DiceFormulaText from '../components/DiceFormulaText';
import { pluralizeUk } from '../utils/pluralize';

export default function CollectionsList({ domainKey }) {
  const domain = COLLECTION_DOMAINS[domainKey];
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    domain.collectionsApi.getAll({ search, scope })
      .then(setCollections)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, scope, domainKey]);

  const activeFilterCount = scope ? 1 : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <CatalogTabs tabs={getDomainTabs(domainKey)} />

      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-text-dim">
          {collections.length} {pluralizeUk(collections.length, ['колекція', 'колекції', 'колекцій'])}
        </p>
        <Button to={`${domain.basePath}/collections/new`} className="hidden md:inline-flex">+ Нова колекція</Button>
      </div>

      <div className="mb-3 flex gap-2.5">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Пошук за назвою..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {domain.supportsCanonical !== false && (
          <FilterToggleButton open={filtersOpen} onClick={() => setFiltersOpen((o) => !o)} activeCount={activeFilterCount} />
        )}
      </div>

      {domain.supportsCanonical !== false && (
        <FilterAccordion open={filtersOpen}>
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Джерело</span>
            <ScopeFilter scope={scope} onChange={setScope} />
          </div>
        </FilterAccordion>
      )}

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : collections.length === 0 ? (
        <EmptyState title="Колекцій не знайдено" action={<Button to={`${domain.basePath}/collections/new`}>Створити першу</Button>} />
      ) : domainKey === 'equipment' ? (
        <EquipmentCollectionsByType collections={collections} basePath={domain.basePath} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Link
              key={c.id}
              to={`${domain.basePath}/collections/${c.id}`}
              className="block overflow-hidden rounded-lg border border-border bg-surface"
              style={{ borderLeft: '4px solid var(--color-accent)' }}
            >
              {c.image_url && (
                <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
                  <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
              )}
              <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2">
                <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-text-dim">
                  {(c.items || []).length} {domain.itemLabel}
                </span>
              </div>
              <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{c.name}</h3>
              {!c.image_url && c.description && (
                <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">
                  <DiceFormulaText text={c.description} />
                </p>
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
