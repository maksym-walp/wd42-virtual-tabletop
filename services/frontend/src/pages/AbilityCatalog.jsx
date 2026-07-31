import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import api from '../api/client';
import AbilityCard from '../components/AbilityCard';
import CatalogTabs from '../components/CatalogTabs';
import { getDomainTabs } from '../collectionsDomains';
import ScopeFilter from '../components/ScopeFilter';
import { ARCHETYPES, ARCHETYPE_COLORS as ARCHETYPE_COLORS_LIGHT, ARCHETYPE_COLORS_DARK } from '../constants/characterSheet';
import { useTheme } from '../context/ThemeContext';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import FilterAccordion from '../components/ui/FilterAccordion';
import FilterToggleButton from '../components/ui/FilterToggleButton';
import EmptyState from '../components/ui/EmptyState';
import ViewToggle from '../components/ui/ViewToggle';
import DataTable from '../components/ui/DataTable';
import CanonBadge from '../components/CanonBadge';
import useViewMode from '../hooks/useViewMode';

const ARCHETYPE_TABS = ['fighter', 'spellcaster', 'rogue'];

const ABILITY_TABLE_COLUMNS = [
  { key: 'name', label: 'Назва', render: (a) => (
    <span className="inline-flex items-center gap-1.5">
      {a.name}
      {a.is_canonical && <CanonBadge />}
    </span>
  ) },
  { key: 'archetypes', label: 'Архетипи', render: (a) => (a.archetypes ?? []).map((k) => ARCHETYPES[k]?.label ?? k).join(', ') || '—' },
  { key: 'owner', label: 'Автор', render: (a) => a.owner_username ? `@${a.owner_username}` : '—' },
];

export default function AbilityCatalog() {
  const { theme } = useTheme();
  const ARCHETYPE_COLORS = theme === 'dark' ? ARCHETYPE_COLORS_DARK : ARCHETYPE_COLORS_LIGHT;
  const [archetype, setArchetype] = useState('');
  const [scope, setScope] = useState('');
  const [abilities, setAbilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useViewMode('abilities');

  useEffect(() => {
    const params = new URLSearchParams();
    if (archetype) params.set('archetype', archetype);
    if (search) params.set('search', search);
    if (scope) params.set('scope', scope);

    setLoading(true);
    api.get(`/api/abilities/?${params}`)
      .then(({ data }) => setAbilities(data.abilities))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [archetype, search, scope]);

  const activeFilterCount = (scope ? 1 : 0) + (archetype ? 1 : 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <CatalogTabs tabs={getDomainTabs('abilities')} right={<ViewToggle mode={view} onChange={setView} />} />

      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-text-dim">{abilities.length} вмінь</p>
        <Button to="/abilities/new" className="hidden md:inline-flex">+ Нове вміння</Button>
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
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Архетип</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setArchetype('')}
              className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                archetype === '' ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
              }`}
            >
              Усі
            </button>
            {ARCHETYPE_TABS.map((a) => (
              <button
                key={a}
                onClick={() => setArchetype(a)}
                className="rounded border px-3 py-1.5 text-sm font-semibold transition-colors"
                style={archetype === a
                  ? { borderColor: ARCHETYPE_COLORS[a].color, color: ARCHETYPE_COLORS[a].color, background: ARCHETYPE_COLORS[a].color + '18' }
                  : { borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
              >
                {ARCHETYPES[a].label}
              </button>
            ))}
          </div>
        </div>
      </FilterAccordion>

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : abilities.length === 0 ? (
        <EmptyState title="Вмінь не знайдено" action={<Button to="/abilities/new">Створити перше</Button>} />
      ) : view === 'table' ? (
        <DataTable
          items={abilities}
          columns={ABILITY_TABLE_COLUMNS}
          getKey={(a) => a.id}
          getHref={(a) => `/abilities/${a.id}`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {abilities.map((a) => <AbilityCard key={a.id} ability={a} />)}
        </div>
      )}

      <Link
        to="/abilities/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label="Нове вміння"
      >
        <Plus size={26} />
      </Link>
    </div>
  );
}
