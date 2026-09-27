import { useState, useEffect } from 'react';
import compendiumApi from '../api/compendium';
import CatalogTabs from '../components/CatalogTabs';
import { getDomainTabs } from '../collectionsDomains';
import CompendiumEntryCard from '../components/compendium/CompendiumEntryCard';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import DataTable from '../components/ui/DataTable';
import useViewMode from '../hooks/useViewMode';
import useHoverPreview from '../hooks/useHoverPreview';
import CatalogLayout, {
  SidebarActions, SidebarSearch, SidebarViewCount, SidebarFilters, MobileFab, CATALOG_GRID,
} from '../components/catalog/CatalogLayout';
import { CatalogPreview, CompendiumEntryPreview } from '../components/catalog/previews';

// Shared by the "НІПи" (/compendium) and "Бестіарій" (/compendium/bestiary)
// tabs — same list shape, filtered server-side by entity_type.
export default function CompendiumEntries({ entityType, title, newLabel }) {
  const [entries, setEntries] = useState([]);
  const [species, setSpecies] = useState([]);
  const [subspecies, setSubspecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [speciesId, setSpeciesId] = useState('');
  const [subspeciesId, setSubspeciesId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useViewMode(`compendium-${entityType}`);
  const [hovered, bindPreview, setHovered] = useHoverPreview();

  useEffect(() => {
    compendiumApi.listSpecies().then(setSpecies).catch(() => {});
  }, []);

  // All subspecies when no species is picked, so the filter is still usable
  // directly without first narrowing by species — same cascade as the entry form.
  useEffect(() => {
    compendiumApi.listSubspecies(speciesId || undefined).then(setSubspecies).catch(() => {});
  }, [speciesId]);

  useEffect(() => {
    setLoading(true);
    compendiumApi.listEntries(entityType)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [entityType]);

  const speciesNameById = Object.fromEntries(species.map((s) => [s.id, s.name]));

  const handleSpeciesFilter = (value) => {
    setSpeciesId(value);
    setSubspeciesId(''); // stale subspecies from a different species is no longer valid
  };

  const filtered = entries.filter((e) =>
    e.name?.toLowerCase().includes(search.toLowerCase()) &&
    (!speciesId || e.species_id === speciesId) &&
    (!subspeciesId || e.subspecies_id === subspeciesId)
  );

  const activeFilterCount = (speciesId ? 1 : 0) + (subspeciesId ? 1 : 0);
  const showCards = view === 'cards';

  const columns = [
    { key: 'name', label: 'Назва', render: (entry) => entry.name },
    { key: 'species', label: 'Вид', render: (entry) => speciesNameById[entry.species_id] ?? '—' },
    { key: 'health', label: "Здоров'я", render: (entry) => entry.health?.formula ?? '—' },
  ];

  const newHref = `/compendium/entries/new?type=${entityType}`;

  const sidebar = (
    <>
      <CatalogTabs sidebar tabs={getDomainTabs('compendium')} />

      <SidebarActions newHref={newHref} newLabel={newLabel} />

      <SidebarSearch value={search} onChange={setSearch} />

      <SidebarViewCount view={view} onViewChange={setView} count={filtered.length} forms={['запис', 'записи', 'записів']} />

      <SidebarFilters open={filtersOpen} onToggle={() => setFiltersOpen((o) => !o)} activeCount={activeFilterCount}>
        <div className="flex flex-col gap-4">
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Вид</span>
            <select className={inputClass} value={speciesId} onChange={(e) => handleSpeciesFilter(e.target.value)}>
              <option value="">Усі види</option>
              {species.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Підвид</span>
            <select className={inputClass} value={subspeciesId} onChange={(e) => setSubspeciesId(e.target.value)}>
              <option value="">Усі підвиди</option>
              {subspecies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      
      </SidebarFilters>
    </>
  );

  return (
    <CatalogLayout
      sidebar={sidebar}
      preview={
        <CatalogPreview item={hovered}>
          {hovered && <CompendiumEntryPreview entry={hovered} speciesName={speciesNameById[hovered.species_id]} />}
        </CatalogPreview>
      }
    >
      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="Нічого не знайдено" action={<Button to={newHref}>Створити перший</Button>} />
      ) : showCards ? (
        <div className={CATALOG_GRID}>
          {filtered.map((entry) => <CompendiumEntryCard key={entry.id} entry={entry} {...bindPreview(entry)} />)}
        </div>
      ) : (
        <DataTable
          items={filtered} columns={columns} getKey={(e) => e.id} getHref={(e) => `/compendium/entries/${e.id}`}
          onRowHover={setHovered}
        />
      )}

      <MobileFab to={newHref} label={newLabel} />
    </CatalogLayout>
  );
}
