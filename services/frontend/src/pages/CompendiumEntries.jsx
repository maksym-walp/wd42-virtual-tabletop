import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import compendiumApi from '../api/compendium';
import CompendiumTabs from '../components/compendium/CompendiumTabs';
import CompendiumEntryCard from '../components/compendium/CompendiumEntryCard';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import FilterAccordion from '../components/ui/FilterAccordion';
import FilterToggleButton from '../components/ui/FilterToggleButton';
import EmptyState from '../components/ui/EmptyState';
import ViewToggle from '../components/ui/ViewToggle';
import useViewMode from '../hooks/useViewMode';

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <CompendiumTabs />

      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-accent sm:text-3xl">{title}</h1>
          <p className="mt-0.5 text-sm text-text-dim">{filtered.length} записів</p>
        </div>
        <Button to={`/compendium/entries/new?type=${entityType}`} className="hidden md:inline-flex">+ {newLabel}</Button>
      </div>

      <div className="mb-5 flex justify-end">
        <ViewToggle mode={view} onChange={setView} />
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      </FilterAccordion>

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="Нічого не знайдено" action={<Button to={`/compendium/entries/new?type=${entityType}`}>Створити перший</Button>} />
      ) : showCards ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => <CompendiumEntryCard key={entry.id} entry={entry} />)}
        </div>
      ) : (
        <EntriesTable entries={filtered} speciesNameById={speciesNameById} />
      )}

      <Link
        to={`/compendium/entries/new?type=${entityType}`}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label={newLabel}
      >
        <Plus size={26} />
      </Link>
    </div>
  );
}

function EntriesTable({ entries, speciesNameById }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr>
            <Th>Назва</Th>
            <Th>Вид</Th>
            <Th>Здоров'я</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-surface-hover">
              <td className="border-b border-bg px-3 py-2">
                <Link to={`/compendium/entries/${entry.id}`} className="text-accent hover:underline">{entry.name}</Link>
                {entry.is_public && <span className="ml-1.5 text-[0.65rem] italic text-text-dim">публічний</span>}
              </td>
              <td className="border-b border-bg px-3 py-2 text-text-muted">{speciesNameById[entry.species_id] ?? '—'}</td>
              <td className="border-b border-bg px-3 py-2 text-text-muted">{entry.health?.formula ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }) {
  return (
    <th className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim">
      {children}
    </th>
  );
}
