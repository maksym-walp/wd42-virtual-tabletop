import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import api from '../api/client';
import ManeuverCard from '../components/ManeuverCard';
import CatalogTabs from '../components/CatalogTabs';
import { getDomainTabs } from '../collectionsDomains';
import ScopeFilter from '../components/ScopeFilter';
import { pluralizeUk } from '../utils/pluralize';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import FilterAccordion from '../components/ui/FilterAccordion';
import FilterToggleButton from '../components/ui/FilterToggleButton';
import EmptyState from '../components/ui/EmptyState';
import ViewToggle from '../components/ui/ViewToggle';
import DataTable from '../components/ui/DataTable';
import useViewMode from '../hooks/useViewMode';

const MANEUVER_TABLE_COLUMNS = [
  { key: 'name', label: 'Назва', render: (m) => m.name },
  { key: 'duration_actions', label: 'Дії', render: (m) => `${m.duration_actions}/3` },
  { key: 'owner', label: 'Автор', render: (m) => m.owner_username ? `@${m.owner_username}` : '—' },
];

export default function ManeuverCatalog() {
  const [maneuvers, setManeuvers] = useState([]);
  const [scope, setScope] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useViewMode('maneuvers');

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (scope) params.set('scope', scope);

    setLoading(true);
    api.get(`/api/abilities/maneuvers/?${params}`)
      .then(({ data }) => setManeuvers(data.maneuvers))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, scope]);

  const activeFilterCount = scope ? 1 : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <CatalogTabs tabs={getDomainTabs('abilities')} />

      <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="col-start-1">
          <ViewToggle mode={view} onChange={setView} />
        </div>
        <p className="col-start-2 hidden justify-self-center text-sm text-text-dim sm:block">
          {maneuvers.length} {pluralizeUk(maneuvers.length, ['маневр', 'маневри', 'маневрів'])}
        </p>
        <Button to="/abilities/maneuvers/new" className="col-start-3 hidden justify-self-end whitespace-nowrap md:inline-flex">+ Новий маневр</Button>
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
      </FilterAccordion>

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : maneuvers.length === 0 ? (
        <EmptyState title="Маневрів не знайдено" action={<Button to="/abilities/maneuvers/new">Створити перший</Button>} />
      ) : view === 'table' ? (
        <DataTable
          items={maneuvers}
          columns={MANEUVER_TABLE_COLUMNS}
          getKey={(m) => m.id}
          getHref={(m) => `/abilities/maneuvers/${m.id}`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {maneuvers.map((m) => <ManeuverCard key={m.id} maneuver={m} />)}
        </div>
      )}

      <Link
        to="/abilities/maneuvers/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label="Новий маневр"
      >
        <Plus size={26} />
      </Link>
    </div>
  );
}
