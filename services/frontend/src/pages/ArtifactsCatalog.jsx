import { useState, useEffect, useCallback } from 'react';
import { Check, Printer } from 'lucide-react';
import api from '../api/client';
import ArtifactCard from '../components/ArtifactCard';
import CatalogTabs from '../components/CatalogTabs';
import ExportImportActions from '../components/ExportImportActions';
import { getDomainTabs } from '../collectionsDomains';
import ScopeFilter from '../components/ScopeFilter';
import { RARITIES } from '../constants/artifacts';
import { useAuth } from '../context/AuthContext';
import { downloadJsonFile } from '../utils/downloadJson';
import { buildArtifactImportTemplate } from '../utils/equipmentImportTemplate';
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

function Checkbox({ checked }) {
  return (
    <span className={`flex h-5 w-5 items-center justify-center rounded border ${
      checked ? 'border-accent bg-accent text-bg' : 'border-border bg-surface'
    }`}
    >
      {checked && <Check size={14} />}
    </span>
  );
}

// У режимі вибору клік по картці не відкриває артефакт, а позначає його для друку:
// прозорий шар поверх посилання перехоплює клік.
function SelectableCard({ selected, onToggle, children }) {
  return (
    <div className={`relative rounded-lg ${selected ? 'ring-2 ring-accent' : ''}`}>
      {children}
      <button
        type="button" onClick={onToggle} aria-pressed={selected} aria-label="Обрати для друку"
        className="absolute inset-0 z-10 cursor-pointer rounded-lg"
      />
      <span className="pointer-events-none absolute right-2 top-2 z-20"><Checkbox checked={selected} /></span>
    </div>
  );
}

const selectColumn = (selected) => ({
  key: 'select', label: '', render: (a) => <Checkbox checked={selected.includes(a.id)} />,
});

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
  const { user } = useAuth();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]); // id-шки у порядку вибору
  const canImport = user?.role === 'admin' || user?.role === 'game_master';

  const fetchArtifacts = useCallback(() => {
    const params = new URLSearchParams({ sort, dir });
    if (search) params.set('search', search);
    if (scope) params.set('scope', scope);
    if (rarity) params.set('rarity', rarity);

    setLoading(true);
    return api.get(`/api/equipment/artifacts/?${params}`)
      .then(({ data }) => setArtifacts(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [rarity, search, sort, dir, scope]);

  useEffect(() => { fetchArtifacts(); }, [fetchArtifacts]);

  // /export віддає усі чотири види спорядження — лишаємо лише артефакти й ті
  // самі search/scope/sort/dir, що й у списку (рідкість фільтруємо на клієнті).
  const handleExport = async () => {
    const params = new URLSearchParams({ sort, dir });
    if (search) params.set('search', search);
    if (scope) params.set('scope', scope);

    try {
      const { data } = await api.get(`/api/equipment/export?${params}`);
      downloadJsonFile(
        data.filter((row) => row.type === 'artifact' && (!rarity || row.rarity === rarity)),
        'artifacts_export.json',
      );
    } catch {
      alert('Не вдалося експортувати артефакти');
    }
  };

  const handleImport = async (data) => {
    if (!Array.isArray(data)) {
      alert('Файл має містити масив артефактів');
      return;
    }
    // Імпорт сортує за type і мовчки пропускає невідомі — тож рядки без
    // type: "artifact" (скажімо, зброя з іншого файлу) тут не пропускаємо.
    const artifactsOnly = data.filter((row) => row?.type === 'artifact');
    if (artifactsOnly.length === 0) {
      alert('У файлі немає записів із "type": "artifact"');
      return;
    }
    try {
      const { data: result } = await api.post('/api/equipment/import', artifactsOnly);
      alert(`Імпортовано артефактів: ${result.imported}`);
      fetchArtifacts();
    } catch (err) {
      alert(err.response?.data?.message || 'Не вдалося імпортувати артефакти');
    }
  };

  const toggleSort = (key) => {
    if (sort === key) { setDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSort(key); setDir('asc'); }
  };

  const toggleSelected = (id) => setSelected((prev) => (
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  ));
  const stopSelecting = () => { setSelectMode(false); setSelected([]); };
  const printHref = (mode) => `/equipment/artifacts/print?ids=${selected.join(',')}&mode=${mode}`;

  const showCards = view === 'cards';
  const activeFilterCount = rarity ? 1 : 0;

  const sortOptions = ARTIFACT_TABLE_COLUMNS.filter((c) => c.sortKey).map((c) => ({ value: c.sortKey, label: c.label }));

  const sidebar = (
    <>
      <CatalogTabs sidebar tabs={getDomainTabs('equipment')} />

      <SidebarActions newHref="/equipment/artifacts/new" newLabel="Новий артефакт">
        <ExportImportActions
          onExport={handleExport}
          onImport={canImport ? handleImport : undefined}
          onTemplate={buildArtifactImportTemplate}
        />
      </SidebarActions>

      <SidebarSearch value={search} onChange={setSearch} />

      <SidebarViewCount
        view={view} onViewChange={setView}
        count={artifacts.length} forms={['артефакт', 'артефакти', 'артефактів']}
      />

      <SidebarSection label="Друк карток">
        {selectMode ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-text-dim">Обрано: {selected.length}</p>
            {selected.length > 0 ? (
              <>
                <Button size="sm" to={printHref('sheet')}><Printer size={14} /> Аркуш A4 × 4</Button>
                <Button size="sm" variant="ghost" to={printHref('card')}>Картки 80×120 мм</Button>
              </>
            ) : (
              <p className="text-xs text-text-dim">Клікни по артефактах, які треба надрукувати.</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setSelected(artifacts.map((a) => a.id))}>
                Усі
              </Button>
              <Button size="sm" variant="ghost" className="flex-1" onClick={stopSelecting}>Скасувати</Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setSelectMode(true)}>
            <Printer size={14} /> Вибрати для друку
          </Button>
        )}
      </SidebarSection>

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
          {artifacts.map((a) => (selectMode ? (
            <SelectableCard key={a.id} selected={selected.includes(a.id)} onToggle={() => toggleSelected(a.id)}>
              <ArtifactCard artifact={a} {...bindPreview(a)} />
            </SelectableCard>
          ) : <ArtifactCard key={a.id} artifact={a} {...bindPreview(a)} />))}
        </div>
      ) : (
        <DataTable
          items={artifacts}
          columns={selectMode ? [selectColumn(selected), ...ARTIFACT_TABLE_COLUMNS] : ARTIFACT_TABLE_COLUMNS}
          getKey={(a) => a.id}
          getHref={selectMode ? undefined : (a) => `/equipment/artifacts/${a.id}`}
          onRowClick={selectMode ? (a) => toggleSelected(a.id) : undefined}
          sort={sort} dir={dir} onSort={toggleSort} onRowHover={setHovered}
        />
      )}

      <MobileFab to="/equipment/artifacts/new" label="Новий артефакт" />
    </CatalogLayout>
  );
}
