import { useState, useEffect } from 'react';
import api from '../api/client';
import ArtifactCard from '../components/ArtifactCard';
import CatalogTabs from '../components/CatalogTabs';
import ExportImportActions from '../components/ExportImportActions';
import { getDomainTabs } from '../collectionsDomains';
import ScopeFilter from '../components/ScopeFilter';
import { RARITIES } from '../constants/artifacts';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import DataTable from '../components/ui/DataTable';
import useViewMode from '../hooks/useViewMode';
import useHoverPreview from '../hooks/useHoverPreview';
import CatalogLayout, {
  SidebarSection, SidebarActions, SidebarSearch, SidebarViewCount, SidebarFilters, MobileFab, CATALOG_GRID,
} from '../components/catalog/CatalogLayout';
import SortSelect from '../components/catalog/SortSelect';
import { CatalogPreview, EquipmentPreview } from '../components/catalog/previews';

const ARTIFACT_TABLE_COLUMNS = [
  { key: 'name', label: 'Назва', sortKey: 'name', render: (a) => a.name },
  { key: 'creator', label: 'Творець', render: (a) => a.creator ?? '—' },
  { key: 'rarity', label: 'Рідкість', sortKey: 'rarity', render: (a) => (a.rarity ? RARITIES[a.rarity]?.label : '—') },
  { key: 'price', label: 'Ціна', sortKey: 'price', render: (a) => a.price ?? '—' },
];

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
  const [hovered, bindPreview, setHovered] = useHoverPreview();

  useEffect(() => {
    const params = new URLSearchParams({ sort, dir });
    if (search) params.set('search', search);
    if (scope) params.set('scope', scope);
    if (rarity) params.set('rarity', rarity);

    setLoading(true);
    api.get(`/api/equipment/artifacts/?${params}`)
      .then(({ data }) => setArtifacts(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [rarity, search, sort, dir, scope]);

  const toggleSort = (key) => {
    if (sort === key) { setDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSort(key); setDir('asc'); }
  };

  const showCards = view === 'cards';
  const activeFilterCount = rarity ? 1 : 0;

  const sortOptions = ARTIFACT_TABLE_COLUMNS.filter((c) => c.sortKey).map((c) => ({ value: c.sortKey, label: c.label }));

  const sidebar = (
    <>
      <CatalogTabs sidebar tabs={getDomainTabs('equipment')} />

      <SidebarActions newHref="/equipment/artifacts/new" newLabel="Новий артефакт">
        {/* Кнопки лише візуальні тут: підключено тільки в EquipmentCatalog. */}
        <ExportImportActions />
      </SidebarActions>

      <SidebarSearch value={search} onChange={setSearch} />

      <SidebarViewCount
        view={view} onViewChange={setView}
        count={artifacts.length} forms={['артефакт', 'артефакти', 'артефактів']}
      />

      <SidebarSection label="Джерело">
        <ScopeFilter scope={scope} onChange={setScope} />
      </SidebarSection>

      <SortSelect options={sortOptions} value={sort} onChange={setSort} dir={dir} onDirChange={setDir} />

      <SidebarFilters open={filtersOpen} onToggle={() => setFiltersOpen((o) => !o)} activeCount={activeFilterCount}>
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
      </SidebarFilters>
    </>
  );

  return (
    <CatalogLayout
      sidebar={sidebar}
      preview={<CatalogPreview item={hovered}>{hovered && <EquipmentPreview item={hovered} artifact />}</CatalogPreview>}
    >
      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : artifacts.length === 0 ? (
        <EmptyState title="Артефактів не знайдено" action={<Button to="/equipment/artifacts/new">Створити перший</Button>} />
      ) : showCards ? (
        <div className={CATALOG_GRID}>
          {artifacts.map((a) => <ArtifactCard key={a.id} artifact={a} {...bindPreview(a)} />)}
        </div>
      ) : (
        <DataTable
          items={artifacts} columns={ARTIFACT_TABLE_COLUMNS}
          getKey={(a) => a.id} getHref={(a) => `/equipment/artifacts/${a.id}`}
          sort={sort} dir={dir} onSort={toggleSort} onRowHover={setHovered}
        />
      )}

      <MobileFab to="/equipment/artifacts/new" label="Новий артефакт" />
    </CatalogLayout>
  );
}
