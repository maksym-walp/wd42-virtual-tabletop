import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import api from '../api/client';
import ArtifactCard from '../components/ArtifactCard';
import CatalogTabs from '../components/CatalogTabs';
import { getDomainTabs } from '../collectionsDomains';
import ScopeFilter from '../components/ScopeFilter';
import { RARITIES } from '../constants/artifacts';
import { pluralizeUk } from '../utils/pluralize';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import FilterAccordion from '../components/ui/FilterAccordion';
import FilterToggleButton from '../components/ui/FilterToggleButton';
import EmptyState from '../components/ui/EmptyState';
import ViewToggle from '../components/ui/ViewToggle';
import useViewMode from '../hooks/useViewMode';

export default function ArtifactsCatalog() {
  const [rarity, setRarity]   = useState('');
  const [scope, setScope]     = useState('');
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [sort, setSort]       = useState('name');
  const [dir, setDir]         = useState('asc');
  const [view, setView]       = useViewMode('artifacts'); // table | cards
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ sort, dir });
    if (search) params.set('search', search);
    if (scope) params.set('scope', scope);
    if (rarity) params.set('rarity', rarity);

    setLoading(true);
    api.get(`/api/artifacts/?${params}`)
      .then(({ data }) => setArtifacts(data.artifacts))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [rarity, search, sort, dir, scope]);

  const toggleSort = (key) => {
    if (sort === key) { setDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSort(key); setDir('asc'); }
  };

  const showCards = view === 'cards';
  const activeFilterCount = (scope ? 1 : 0) + (rarity ? 1 : 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <CatalogTabs tabs={getDomainTabs('artifacts')} />

      <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="col-start-1">
          <ViewToggle mode={view} onChange={setView} />
        </div>
        <p className="col-start-2 hidden justify-self-center text-sm text-text-dim sm:block">
          {artifacts.length} {pluralizeUk(artifacts.length, ['артефакт', 'артефакти', 'артефактів'])}
        </p>
        <Button to="/artifacts/new" className="col-start-3 hidden justify-self-end whitespace-nowrap md:inline-flex">+ Новий артефакт</Button>
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
        <FilterToggleButton open={filtersOpen} onClick={() => setFiltersOpen((o) => !o)} activeCount={activeFilterCount} />
      </div>

      <FilterAccordion open={filtersOpen}>
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Джерело</span>
          <ScopeFilter scope={scope} onChange={setScope} />
        </div>

        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Рідкість</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setRarity('')}
              className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                rarity === '' ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
              }`}
            >
              Усі
            </button>
            {Object.entries(RARITIES).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => setRarity(key)}
                className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  rarity === key ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </FilterAccordion>

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : artifacts.length === 0 ? (
        <EmptyState title="Артефактів не знайдено" action={<Button to="/artifacts/new">Створити перший</Button>} />
      ) : showCards ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((a) => <ArtifactCard key={a.id} artifact={a} />)}
        </div>
      ) : (
        <ArtifactsTable artifacts={artifacts} sort={sort} dir={dir} onSort={toggleSort} />
      )}

      <Link
        to="/artifacts/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label="Новий артефакт"
      >
        <Plus size={26} />
      </Link>
    </div>
  );
}

function Th({ label, sortKey, sort, dir, onSort, className = '' }) {
  const active = sort === sortKey;
  return (
    <th
      className={`cursor-pointer select-none whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim hover:text-text ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-accent">{dir === 'desc' ? '↓' : '↑'}</span>}
      </span>
    </th>
  );
}

function ArtifactsTable({ artifacts, sort, dir, onSort }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            <Th label="Назва" sortKey="name" sort={sort} dir={dir} onSort={onSort} />
            <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim">Творець</th>
            <Th label="Рідкість" sortKey="rarity" sort={sort} dir={dir} onSort={onSort} />
            <Th label="Ціна" sortKey="price" sort={sort} dir={dir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {artifacts.map((a) => (
            <tr key={a.id} className="hover:bg-surface-hover">
              <td className="border-b border-bg px-3 py-2">
                <Link to={`/artifacts/${a.id}`} className="text-accent hover:underline">{a.name}</Link>
                {a.is_public && <span className="ml-1.5 text-[0.65rem] italic text-text-dim">публічне</span>}
              </td>
              <td className="border-b border-bg px-3 py-2 text-text-muted">{a.creator ?? '—'}</td>
              <td className="border-b border-bg px-3 py-2 text-text-muted">
                {a.rarity ? RARITIES[a.rarity]?.label : '—'}
              </td>
              <td className="border-b border-bg px-3 py-2 text-text-muted">{a.price ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
