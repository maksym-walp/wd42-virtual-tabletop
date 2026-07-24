import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import api from '../api/client';
import ManeuverCard from '../components/ManeuverCard';
import CollectionsRow from '../components/CollectionsRow';
import ScopeFilter from '../components/ScopeFilter';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import FilterAccordion from '../components/ui/FilterAccordion';
import FilterToggleButton from '../components/ui/FilterToggleButton';
import EmptyState from '../components/ui/EmptyState';
import ViewToggle from '../components/ui/ViewToggle';
import DataTable from '../components/ui/DataTable';
import CanonBadge from '../components/CanonBadge';
import useViewMode from '../hooks/useViewMode';

const MANEUVER_TABLE_COLUMNS = [
  { key: 'name', label: 'Назва', render: (m) => (
    <span className="inline-flex items-center gap-1.5">
      {m.name}
      {m.is_canonical && <CanonBadge />}
    </span>
  ) },
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
    api.get(`/api/maneuvers/?${params}`)
      .then(({ data }) => setManeuvers(data.maneuvers))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, scope]);

  // Hide collections when the user narrows the list with a search. Scope is
  // excluded — it keeps collections split, not hidden.
  const filtersActive = search.trim() !== '';
  const activeFilterCount = scope ? 1 : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-accent sm:text-3xl">Маневри</h1>
          <p className="mt-0.5 text-sm text-text-dim">{maneuvers.length} маневрів</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" to="/maneuvers/collections">Колекції</Button>
          <Button to="/maneuvers/new" className="hidden md:inline-flex">+ Новий маневр</Button>
        </div>
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
        <ViewToggle mode={view} onChange={setView} />
      </div>

      <FilterAccordion open={filtersOpen}>
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Джерело</span>
          <ScopeFilter scope={scope} onChange={setScope} />
        </div>
      </FilterAccordion>

      {!filtersActive && <CollectionsRow domainKey="maneuvers" scope={scope} />}

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : maneuvers.length === 0 ? (
        <EmptyState title="Маневрів не знайдено" action={<Button to="/maneuvers/new">Створити перший</Button>} />
      ) : view === 'table' ? (
        <DataTable
          items={maneuvers}
          columns={MANEUVER_TABLE_COLUMNS}
          getKey={(m) => m.id}
          getHref={(m) => `/maneuvers/${m.id}`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {maneuvers.map((m) => <ManeuverCard key={m.id} maneuver={m} />)}
        </div>
      )}

      <Link
        to="/maneuvers/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label="Новий маневр"
      >
        <Plus size={26} />
      </Link>
    </div>
  );
}
